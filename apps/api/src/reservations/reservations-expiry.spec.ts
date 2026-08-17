import { ConflictException, NotFoundException } from '@nestjs/common';
import { Reservation, Table } from '../entities/entities';
import { createTestContext, TestContext, RESERVATION_HOLD_MINUTES } from '../test-context';

describe('ReservationsService — expiración en servidor y bloqueo de doble reserva', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.ds.destroy();
  });

  it('crea reserva PENDIENTE con expiresAt calculado EN SERVIDOR (+15 min, regla B)', async () => {
    const before = Date.now();
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    expect(res.estado).toBe('PENDIENTE');
    expect(res.expiresAt).toBeInstanceOf(Date);
    const delta = res.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(RESERVATION_HOLD_MINUTES * 60 * 1000 - 2000);
    expect(delta).toBeLessThanOrEqual(RESERVATION_HOLD_MINUTES * 60 * 1000 + 2000);
    // Mesa NO pasa a RESERVADA hasta confirmar (solo PENDIENTE retiene el slot)
    const table = await ctx.ds.getRepository(Table).findOneBy({ id: ctx.t1.id });
    expect(table?.estado).toBe('LIBRE');
  });

  it('BLOQUEA doble reserva de la misma mesa en el mismo slot con 409 (mutex, regla D)', async () => {
    await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    await expect(
      ctx.reservations.create(ctx.user.id, {
        tableId: ctx.t1.id,
        fecha: '2026-09-01',
        hora: '21:00', // solapa el slot 20:30-22:30
        numComensales: 2,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('permite reservar la misma mesa en horario NO solapado', async () => {
    await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '13:00', // no solapa
      numComensales: 2,
    });
    expect(res.estado).toBe('PENDIENTE');
  });

  it('sweeper expira PENDIENTE vencidas → VENCIDA y libera el slot (regla C, sin requests)', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    // Forzar que la reserva ya venció
    const repo = ctx.ds.getRepository(Reservation);
    const row = await repo.findOneBy({ id: res.id });
    row!.expiresAt = new Date(Date.now() - 1000);
    await repo.save(row!);

    const { expired } = await ctx.reservations.expireStale();
    expect(expired).toBe(1);

    const after = await repo.findOneBy({ id: res.id });
    expect(after?.estado).toBe('VENCIDA');

    // El slot queda libre: se puede reservar la misma mesa a la misma hora
    const again = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    expect(again.estado).toBe('PENDIENTE');
  });

  it('confirmar ANTES de expirar → CONFIRMADA y mesa RESERVADA', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    const confirmed = await ctx.reservations.confirm(res.id);
    expect(confirmed.estado).toBe('CONFIRMADA');
    const table = await ctx.ds.getRepository(Table).findOneBy({ id: ctx.t1.id });
    expect(table?.estado).toBe('RESERVADA');
  });

  it('confirmar una reserva YA VENCIDA → 409 (no se puede confirmar el slot expirado)', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    const repo = ctx.ds.getRepository(Reservation);
    const row = await repo.findOneBy({ id: res.id });
    row!.expiresAt = new Date(Date.now() - 1000);
    await repo.save(row!);
    await expect(ctx.reservations.confirm(res.id)).rejects.toThrow(ConflictException);
  });

  it('cancelar una reserva PENDIENTE libera el slot para otros', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    await ctx.reservations.cancel(ctx.user.id, res.id);
    const again = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    expect(again.estado).toBe('PENDIENTE');
  });

  it('rechaza reservar con más comensales que la capacidad de la mesa (409)', async () => {
    await expect(
      ctx.reservations.create(ctx.user.id, {
        tableId: ctx.t1.id, // capacidad 2
        fecha: '2026-09-01',
        hora: '19:00',
        numComensales: 3,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('findForUser solo devuelve las reservas propias; la de otro usuario → NotFound', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    const own = await ctx.reservations.findForUser(ctx.user.id, res.id);
    expect(own.id).toBe(res.id);
    await expect(ctx.reservations.findForUser('otro-usuario', res.id)).rejects.toThrow(NotFoundException);
  });

  it('complete() (host) marca COMPLETADA y libera la mesa si estaba RESERVADA', async () => {
    const res = await ctx.reservations.create(ctx.user.id, {
      tableId: ctx.t1.id,
      fecha: '2026-09-01',
      hora: '20:30',
      numComensales: 2,
    });
    await ctx.reservations.confirm(res.id);
    const completed = await ctx.reservations.complete(res.id);
    expect(completed.estado).toBe('COMPLETADA');
    const table = await ctx.ds.getRepository(Table).findOneBy({ id: ctx.t1.id });
    expect(table?.estado).toBe('LIBRE');
  });
});