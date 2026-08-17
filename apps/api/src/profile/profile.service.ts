import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuOrder, Reservation, User } from '../entities/entities';
import { pointsForTotal } from '../entities/entities';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(MenuOrder) private readonly orders: Repository<MenuOrder>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Perfil del comensal: historial de pedidos + reservas + puntos (totales consistentes). */
  async profile(userId: string): Promise<{
    user: { id: string; nombre: string; email: string; username: string; puntosAcumulados: number };
    pedidos: { id: string; numero: string; mesa: string; totalCents: number; estado: string; createdAt: Date; puntosGanados: number; itemsCount: number }[];
    reservas: Reservation[];
    stats: { totalPedidos: number; totalGastadoCents: number; puntosTotales: number };
  }> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new Error('Usuario no encontrado');

    const [orders, reservas] = await Promise.all([
      this.orders.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      this.reservations.find({ where: { userId }, relations: { table: true }, order: { createdAt: 'DESC' } }),
    ]);

    let totalGastadoCents = 0;
    let puntosTotales = 0;
    const pedidos = orders.map((o) => {
      const itemsCount = (o.items ?? []).reduce((acc, i) => acc + i.qty, 0);
      if (o.estado === 'COBRADO') {
        totalGastadoCents += o.totalCents;
        puntosTotales += pointsForTotal(o.totalCents);
      }
      return {
        id: o.id,
        numero: o.numero,
        mesa: o.mesa,
        totalCents: o.totalCents,
        estado: o.estado,
        createdAt: o.createdAt,
        puntosGanados: pointsForTotal(o.totalCents),
        itemsCount,
      };
    });

    return {
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        username: user.username,
        puntosAcumulados: user.puntosAcumulados,
      },
      pedidos,
      reservas,
      stats: { totalPedidos: pedidos.length, totalGastadoCents, puntosTotales },
    };
  }
}