import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyLedger, User } from '../entities/entities';
import { pointsForTotal } from '../entities/entities';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyLedger) private readonly ledger: Repository<LoyaltyLedger>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Movimientos de puntos del comensal (derivados de pedidos reales, regla F). */
  async ledgerFor(userId: string): Promise<LoyaltyLedger[]> {
    return this.ledger.find({ where: { userId }, order: { ts: 'DESC' } });
  }

  /** Punto de entrada del perfil: puntos actuales + total derivado de pedidos. */
  async summary(userId: string): Promise<{ puntos: number; pedidosConPuntos: number }> {
    const user = await this.users.findOneBy({ id: userId });
    const entries = await this.ledger.find({ where: { userId } });
    const pedidosConPuntos = entries.filter((e) => e.concepto === 'PEDIDO').length;
    return { puntos: user?.puntosAcumulados ?? 0, pedidosConPuntos };
  }

  static pointsForTotal(totalCents: number): number {
    return pointsForTotal(totalCents);
  }
}