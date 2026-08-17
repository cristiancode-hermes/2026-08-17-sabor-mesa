import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuOrder, Reservation, Table, TableStatus } from '../entities/entities';

export interface TableDTO {
  id: string;
  numero: string;
  capacidad: number;
  estado: TableStatus;
  ubicacion: string;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private readonly tables: Repository<Table>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(MenuOrder) private readonly orders: Repository<MenuOrder>,
  ) {}

  /**
   * Mesas libres para un slot (fecha + hora + comensales).
   * Una mesa es apta si: capacidad >= comensales, no LIBRE, no está ocupada por pedido
   * activo, y no tiene reserva PENDIENTE/CONFIRMADA que solape el slot.
   */
  async available(opts: { fecha: string; hora: string; comensales: number }): Promise<TableDTO[]> {
    const fecha = opts.fecha?.trim();
    const hora = opts.hora?.trim();
    const comensales = Number(opts.comensales);
    if (!fecha || !hora || !comensales) {
      throw new BadRequestException('Indica fecha, hora y número de comensales');
    }
    const durationMin = 120;
    const start = toMinutes(hora);
    const end = start + durationMin;

    const tables = await this.tables.find({ order: { numero: 'ASC' } });
    const result: TableDTO[] = [];
    for (const t of tables) {
      if (t.capacidad < comensales) continue;
      // Ocupada por pedido activo
      const activeOrder = await this.orders
        .createQueryBuilder('o')
        .where('o.mesa = :mesa AND o.estado IN (:...estados)', {
          mesa: t.numero,
          estados: ['ENVIADO', 'EN_COCINA', 'SERVIDO'],
        })
        .getCount();
      if (activeOrder > 0) continue;
      // Conflicto de reserva en el mismo slot
      const conflicting = await this.reservations
        .createQueryBuilder('r')
        .where('r.tableId = :tableId AND r.estado IN (:...estados)', {
          tableId: t.id,
          estados: ['PENDIENTE', 'CONFIRMADA'],
        })
        .getMany();
      const overlaps = conflicting.some((r) => {
        if (r.fechaReserva !== fecha) return false;
        const rStart = toMinutes(r.horaInicio);
        const rEnd = rStart + slotDuration(r.horaInicio, r.horaFin);
        return start < rEnd && end > rStart;
      });
      if (overlaps) continue;
      result.push({ id: t.id, numero: t.numero, capacidad: t.capacidad, estado: t.estado, ubicacion: t.ubicacion });
    }
    return result;
  }

  /** Estado del salón para el gerente (todas las mesas). */
  async all(): Promise<TableDTO[]> {
    const tables = await this.tables.find({ order: { numero: 'ASC' } });
    return tables.map((t) => ({ id: t.id, numero: t.numero, capacidad: t.capacidad, estado: t.estado, ubicacion: t.ubicacion }));
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function slotDuration(start: string, end: string): number {
  return Math.max(60, toMinutes(end) - toMinutes(start));
}