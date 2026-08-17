import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuOrder, Table } from '../entities/entities';

export interface RevenuePoint {
  hora: string;
  totalCents: number;
  pedidos: number;
}

export interface ManagerStats {
  fecha: string;
  ingresosCents: number;
  pedidos: number;
  platosServidos: number;
  mesas: { total: number; libres: number; ocupadas: number; reservadas: number; sucias: number };
  ticketMedioCents: number;
}

@Injectable()
export class ManagerService {
  constructor(
    @InjectRepository(MenuOrder) private readonly orders: Repository<MenuOrder>,
    @InjectRepository(Table) private readonly tables: Repository<Table>,
  ) {}

  /** Totales del día (agregación backend — lista == detalle). */
  async stats(fecha?: string): Promise<ManagerStats> {
    const date = fecha?.trim() || toLocalDateStr();
    const orders = await this.orders.find({ order: { createdAt: 'ASC' } });
    const dayOrders = orders.filter((o) => toLocalDate(o.createdAt) === date);

    const ingresosCents = dayOrders.filter((o) => o.estado === 'COBRADO').reduce((acc, o) => acc + o.totalCents, 0);
    const platosServidos = dayOrders
      .filter((o) => o.estado === 'COBRADO')
      .reduce((acc, o) => acc + (o.items ?? []).reduce((a, i) => a + i.qty, 0), 0);
    const cobrados = dayOrders.filter((o) => o.estado === 'COBRADO').length;

    const allTables = await this.tables.find();
    const mesas = {
      total: allTables.length,
      libres: allTables.filter((t) => t.estado === 'LIBRE').length,
      ocupadas: allTables.filter((t) => t.estado === 'OCUPADA').length,
      reservadas: allTables.filter((t) => t.estado === 'RESERVADA').length,
      sucias: allTables.filter((t) => t.estado === 'SUCIO').length,
    };

    return {
      fecha: date,
      ingresosCents,
      pedidos: dayOrders.length,
      platosServidos,
      mesas,
      ticketMedioCents: cobrados > 0 ? Math.round(ingresosCents / cobrados) : 0,
    };
  }

  /** Serie de ingresos por hora para el gráfico (ejes, fechas, tooltip). */
  async revenue(fecha?: string): Promise<RevenuePoint[]> {
    const date = fecha?.trim() || toLocalDateStr();
    const orders = await this.orders.find({ order: { createdAt: 'ASC' } });
    const byHour = new Map<string, { total: number; pedidos: number }>();
    for (const o of orders) {
      if (toLocalDate(o.createdAt) !== date) continue;
      if (o.estado !== 'COBRADO') continue;
      const hour = String(new Date(o.createdAt).getHours()).padStart(2, '0');
      const cur = byHour.get(hour) ?? { total: 0, pedidos: 0 };
      cur.total += o.totalCents;
      cur.pedidos += 1;
      byHour.set(hour, cur);
    }
    const points: RevenuePoint[] = [];
    for (let h = 13; h <= 23; h++) {
      const key = String(h).padStart(2, '0');
      const cur = byHour.get(key);
      points.push({ hora: `${key}:00`, totalCents: cur?.total ?? 0, pedidos: cur?.pedidos ?? 0 });
    }
    return points;
  }
}

function toLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDateStr(): string {
  return toLocalDate(new Date());
}