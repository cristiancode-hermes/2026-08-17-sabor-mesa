import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Table, User } from '../entities/entities';
import { createTestContext, TestContext } from '../test-context';

describe('OrdersService — ciclo transaccional del pedido a mesa', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.ds.destroy();
  });

  it('crea un pedido ENVIADO, calcula el total en backend y marca la mesa OCUPADA', async () => {
    const order = await ctx.orders.create({
      mesa: 'M-1',
      items: [
        { menuItemId: ctx.pulpo.id, qty: 2 },
        { menuItemId: ctx.agua.id, qty: 1 },
      ],
    });
    expect(order.estado).toBe('ENVIADO');
    // 1980*2 + 250 = 4210 céntimos — total derivado de items, no del cliente
    expect(order.totalCents).toBe(4210);
    expect(order.mesa).toBe('M-1');
    expect(order.dishStatuses?.length).toBe(2);
    expect(order.dishStatuses?.every((d) => d.estadoPlato === 'PENDIENTE')).toBe(true);

    const table = await ctx.ds.getRepository(Table).findOneBy({ numero: 'M-1' });
    expect(table?.estado).toBe('OCUPADA');
  });

  it('BLOQUEA doble pedido en la misma mesa con 409 (mutex, regla D)', async () => {
    await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.pulpo.id, qty: 1 }] });
    await expect(
      ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.fideua.id, qty: 1 }] }),
    ).rejects.toThrow(ConflictException);
    // El pedido original sigue activo
    const active = await ctx.orders.findByTable('M-1');
    expect(active).not.toBeNull();
    expect(active!.estado).toBe('ENVIADO');
  });

  it('permite pedir de nuevo en otra mesa distinta', async () => {
    await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.pulpo.id, qty: 1 }] });
    const second = await ctx.orders.create({ mesa: 'M-2', items: [{ menuItemId: ctx.fideua.id, qty: 1 }] });
    expect(second.mesa).toBe('M-2');
  });

  it('rechaza transiciones inválidas (ENVIADO → COBRADO salta EN_COCINA/SERVIDO)', async () => {
    const order = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.pulpo.id, qty: 1 }] });
    await expect(ctx.orders.transition(order.id, 'COBRADO')).rejects.toThrow(BadRequestException);
  });

  it('avanza ENVIADO → EN_COCINA → SERVIDO siguiendo la máquina de estados', async () => {
    const order = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.pulpo.id, qty: 1 }] });
    const enCocina = await ctx.orders.transition(order.id, 'EN_COCINA');
    expect(enCocina.estado).toBe('EN_COCINA');
    expect(enCocina.sentToKitchenAt).toBeInstanceOf(Date);

    // servir el único plato → pedido SERVIDO automáticamente
    const servido = await ctx.orders.serveDish(order.id, ctx.pulpo.id);
    expect(servido.estado).toBe('SERVIDO');
    expect(servido.dishStatuses?.[0].estadoPlato).toBe('SERVIDO');
  });

  it('no marca el pedido SERVIDO hasta que TODOS los platos estén servidos', async () => {
    const order = await ctx.orders.create({
      mesa: 'M-1',
      items: [
        { menuItemId: ctx.pulpo.id, qty: 1 },
        { menuItemId: ctx.fideua.id, qty: 1 },
      ],
    });
    await ctx.orders.transition(order.id, 'EN_COCINA');
    const parcial = await ctx.orders.serveDish(order.id, ctx.pulpo.id);
    expect(parcial.estado).toBe('EN_COCINA');
    const completo = await ctx.orders.serveDish(order.id, ctx.fideua.id);
    expect(completo.estado).toBe('SERVIDO');
  });

  it('cobra la cuenta: COBRADO en backend, mesa LIBRE, puntos = floor(total/10) y QR comprobante (reglas A/F/E)', async () => {
    const order = await ctx.orders.create({
      mesa: 'M-1',
      items: [
        { menuItemId: ctx.pulpo.id, qty: 2 }, // 3960
        { menuItemId: ctx.tarta.id, qty: 1 }, // 680 → total 4640 → 4 puntos
      ],
    });
    await ctx.orders.transition(order.id, 'EN_COCINA');
    await ctx.orders.serveDish(order.id, ctx.pulpo.id);
    await ctx.orders.serveDish(order.id, ctx.tarta.id);

    const result = await ctx.orders.pay(ctx.user.id, order.id);
    expect(result.order.estado).toBe('COBRADO');
    expect(result.order.paidAt).toBeInstanceOf(Date);
    expect(result.puntosGanados).toBe(Math.floor(4640 / 1000)); // 4 puntos
    expect(result.comprobante.qrSvg).toContain('<svg');
    expect(result.comprobante.numero).toMatch(/^\d{4}-\d{4}-\d{3}$/);

    // Mesa libre en backend (la transacción no termina en pantalla)
    const table = await ctx.ds.getRepository(Table).findOneBy({ numero: 'M-1' });
    expect(table?.estado).toBe('LIBRE');

    // Puntos en el ledger y en el usuario
    const user = await ctx.ds.getRepository(User).findOneBy({ id: ctx.user.id });
    expect(user?.puntosAcumulados).toBe(4);
    const ledger = await ctx.ds.getRepository('LoyaltyLedger' as any).find({ where: { userId: ctx.user.id } });
    expect(ledger.length).toBe(1);
    expect(ledger[0].delta).toBe(4);
    expect(ledger[0].totalRecomCents).toBe(4640);

    // Email simulado (comprobante fuera de la web)
    const emails = await ctx.ds.getRepository('EmailLog' as any).find({ where: { orderId: order.id } });
    expect(emails.length).toBe(1);
  });

  it('tras cobrar, la mesa acepta un pedido NUEVO (el mutex se libera)', async () => {
    const order = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.agua.id, qty: 1 }] });
    await ctx.orders.transition(order.id, 'EN_COCINA');
    await ctx.orders.serveDish(order.id, ctx.agua.id);
    await ctx.orders.pay(ctx.user.id, order.id);

    const second = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.fideua.id, qty: 1 }] });
    expect(second.mesa).toBe('M-1');
  });

  it('rechaza pagar un pedido ya cobrado (ConflictException)', async () => {
    const order = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.agua.id, qty: 1 }] });
    await ctx.orders.transition(order.id, 'EN_COCINA');
    await ctx.orders.serveDish(order.id, ctx.agua.id);
    await ctx.orders.pay(ctx.user.id, order.id);
    await expect(ctx.orders.pay(ctx.user.id, order.id)).rejects.toThrow(ConflictException);
  });

  it('cancelar un pedido activo libera la mesa', async () => {
    const order = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.agua.id, qty: 1 }] });
    const cancelled = await ctx.orders.transition(order.id, 'CANCELADO');
    expect(cancelled.estado).toBe('CANCELADO');
    const table = await ctx.ds.getRepository(Table).findOneBy({ numero: 'M-1' });
    expect(table?.estado).toBe('LIBRE');
  });

  it('la cola de cocina expone solo pedidos ENVIADO/EN_COCINA', async () => {
    const a = await ctx.orders.create({ mesa: 'M-1', items: [{ menuItemId: ctx.pulpo.id, qty: 1 }] });
    const b = await ctx.orders.create({ mesa: 'M-2', items: [{ menuItemId: ctx.fideua.id, qty: 1 }] });
    await ctx.orders.transition(b.id, 'EN_COCINA');
    const queue = await ctx.orders.activeKitchen();
    const ids = queue.map((o) => o.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(queue.every((o) => ['ENVIADO', 'EN_COCINA'].includes(o.estado))).toBe(true);
  });

  it('pedido inexistente → NotFound', async () => {
    await expect(ctx.orders.findById('no-existe')).rejects.toThrow(NotFoundException);
  });
});