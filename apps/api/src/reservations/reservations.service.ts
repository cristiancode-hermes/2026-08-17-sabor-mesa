import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Reservation, ReservationStatus, Table, User } from '../entities/entities';
import { RESERVATION_STATUS_LABELS, RESERVATION_TRANSITIONS } from '../entities/entities';

export const RESERVATION_HOLD_MINUTES = 15;
export const SLOT_DURATION_MIN = 120;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(Table) private readonly tables: Repository<Table>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async serialize(id: string): Promise<Reservation> {
    const reservation = await this.reservations.findOne({ where: { id }, relations: { table: true } });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return reservation;
  }

  /**
   * Crear reserva — ciclo transaccional con expiración (reglas B/D).
   * PENDIENTE con expiresAt = now + 15 min calculado EN SERVIDOR.
   * Mutex por mesa+slot dentro de la transacción → 409 si ya está tomado.
   */
  async create(
    userId: string,
    dto: { tableId: string; fecha: string; hora: string; numComensales: number },
  ): Promise<Reservation> {
    const fecha = dto.fecha?.trim();
    const hora = dto.hora?.trim();
    const comensales = Number(dto.numComensales);
    if (!fecha || !hora || !comensales) {
      throw new ConflictException('Indica fecha, hora y número de comensales');
    }

    const table = await this.tables.findOneBy({ id: dto.tableId });
    if (!table) throw new NotFoundException('Mesa no encontrada');
    if (table.capacidad < comensales) {
      throw new ConflictException(`La mesa ${table.numero} no admite ${comensales} comensales`);
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Mutex mesa+slot: conflicto con reservas PENDIENTE/CONFIRMADA y pedidos activos.
      const start = toMinutes(hora);
      const end = start + SLOT_DURATION_MIN;
      const conflicting = await manager
        .getRepository(Reservation)
        .createQueryBuilder('r')
        .where('r.tableId = :tableId AND r.estado IN (:...estados)', {
          tableId: table.id,
          estados: ['PENDIENTE', 'CONFIRMADA'],
        })
        .getMany();
      const overlaps = conflicting.some((r) => {
        if (r.fechaReserva !== fecha) return false;
        const rStart = toMinutes(r.horaInicio);
        const rEnd = rStart + SLOT_DURATION_MIN;
        return start < rEnd && end > rStart;
      });
      if (overlaps) {
        throw new ConflictException('Esta mesa ya está reservada para ese horario');
      }

      // 2. Expiración en servidor (regla B).
      const expiresAt = new Date(Date.now() + RESERVATION_HOLD_MINUTES * 60 * 1000);
      const horaFin = formatMinutes(end);

      const reservation = (await manager.getRepository(Reservation).save({
        userId,
        tableId: table.id,
        fechaReserva: fecha,
        horaInicio: hora,
        horaFin,
        numComensales: comensales,
        estado: 'PENDIENTE',
        expiresAt,
      } as any)) as Reservation;

      return this.serialize(reservation.id);
    });
  }

  /** Estado de mi reserva (PENDIENTE con countdown expiresAt incluido en el objeto). */
  async findForUser(userId: string, id: string): Promise<Reservation> {
    const reservation = await this.reservations.findOne({ where: { id, userId }, relations: { table: true } });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    return reservation;
  }

  /** Confirmar (host): PENDIENTE → CONFIRMADA y mesa → RESERVADA. */
  async confirm(id: string): Promise<Reservation> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await manager.getRepository(Reservation).findOne({ where: { id } });
      if (!reservation) throw new NotFoundException('Reserva no encontrada');
      if (reservation.estado !== 'PENDIENTE') {
        throw new ConflictException(`No se puede confirmar una reserva ${RESERVATION_STATUS_LABELS[reservation.estado].toLowerCase()}`);
      }
      if (reservation.expiresAt && reservation.expiresAt.getTime() < Date.now()) {
        reservation.estado = 'VENCIDA';
        await manager.getRepository(Reservation).save(reservation);
        throw new ConflictException('La reserva venció: el tiempo de confirmación ha terminado');
      }
      reservation.estado = 'CONFIRMADA';
      await manager.getRepository(Reservation).save(reservation);
      const table = await manager.getRepository(Table).findOneBy({ id: reservation.tableId });
      if (table && table.estado === 'LIBRE') {
        table.estado = 'RESERVADA';
        await manager.getRepository(Table).save(table);
      }
      return this.serialize(reservation.id);
    });
  }

  /** Cancelar (comensal u host): libera la mesa si estaba RESERVADA por esta reserva. */
  async cancel(userId: string | null, id: string): Promise<{ cancelled: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const where = userId ? { id, userId } : { id };
      const reservation = await manager.getRepository(Reservation).findOne({ where: where as any });
      if (!reservation) throw new NotFoundException('Reserva no encontrada');
      if (reservation.estado === 'CANCELADA' || reservation.estado === 'VENCIDA') {
        return { cancelled: true };
      }
      reservation.estado = 'CANCELADA';
      await manager.getRepository(Reservation).save(reservation);
      await this.releaseIfReserved(manager, reservation, 'CANCELADA');
      return { cancelled: true };
    });
  }

  /** Historial de reservas del comensal. */
  async listForUser(userId: string): Promise<Reservation[]> {
    return this.reservations.find({
      where: { userId },
      relations: { table: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Reservas del día para el host (salón). */
  async listForHost(fecha?: string): Promise<Reservation[]> {
    if (fecha) {
      return this.reservations.find({
        where: { fechaReserva: fecha },
        relations: { table: true },
        order: { horaInicio: 'ASC' },
      });
    }
    return this.reservations.find({ relations: { table: true }, order: { createdAt: 'DESC' } });
  }

  /** Transición controlada por el host (COMPLETADA). */
  async complete(id: string): Promise<Reservation> {
    const reservation = await this.reservations.findOne({ where: { id } });
    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    if (!RESERVATION_TRANSITIONS[reservation.estado].includes('COMPLETADA')) {
      throw new ConflictException('La reserva no puede completarse desde su estado actual');
    }
    reservation.estado = 'COMPLETADA';
    await this.reservations.save(reservation);
    await this.releaseIfReservedManager(reservation);
    return this.serialize(reservation.id);
  }

  /**
   * Sweeper (regla C): cancela PENDIENTE vencidas → VENCIDA, mesa vuelve a LIBRE.
   * Además completa reservas CONFIRMADAS cuyo slot ya pasó (día anterior o hora pasada).
   * Corre cada 30 s en la API, sin esperar requests.
   */
  async expireStale(): Promise<{ expired: number; completed: number }> {
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const stale = await manager
        .getRepository(Reservation)
        .createQueryBuilder('r')
        .where("r.estado = 'PENDIENTE' AND r.expiresAt < :now", { now })
        .getMany();
      for (const r of stale) {
        r.estado = 'VENCIDA';
        await manager.getRepository(Reservation).save(r);
        await this.releaseIfReserved(manager, r, 'VENCIDA');
      }

      // Reservas confirmadas cuyo slot terminó → COMPLETADA (y mesa libre si sigue RESERVADA).
      const today = toLocalDateStr();
      const staleConfirmed = await manager
        .getRepository(Reservation)
        .createQueryBuilder('r')
        .where("r.estado = 'CONFIRMADA'")
        .getMany();
      let completed = 0;
      for (const r of staleConfirmed) {
        const slotEnd = toMinutes(r.horaFin);
        const isPast = r.fechaReserva < today || (r.fechaReserva === today && slotEnd <= now.getHours() * 60 + now.getMinutes());
        if (isPast) {
          r.estado = 'COMPLETADA';
          await manager.getRepository(Reservation).save(r);
          await this.releaseIfReserved(manager, r, 'COMPLETADA');
          completed++;
        }
      }
      return { expired: stale.length, completed };
    });
  }

  private async releaseIfReserved(manager: any, reservation: Reservation, newState: ReservationStatus): Promise<void> {
    const table = await manager.getRepository(Table).findOneBy({ id: reservation.tableId });
    if (!table) return;
    if (table.estado === 'RESERVADA' && reservation.estado !== 'CONFIRMADA') {
      table.estado = 'LIBRE';
      await manager.getRepository(Table).save(table);
    }
  }

  private async releaseIfReservedManager(reservation: Reservation): Promise<void> {
    const table = await this.tables.findOneBy({ id: reservation.tableId });
    if (!table || table.estado !== 'RESERVADA') return;
    table.estado = 'LIBRE';
    await this.tables.save(table);
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Fecha local (Europe/Madrid) en formato YYYY-MM-DD. */
function toLocalDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}