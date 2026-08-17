import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';

/**
 * Sweeper — expiración automática de reservas vencidas (regla C).
 * Corre cada 30 s en la API, independiente de requests de clientes:
 * cancela PENDIENTE vencidas → VENCIDA, libera la mesa, y completa
 * CONFIRMADAS cuyo slot ya pasó. Sin recargar página.
 */
@Injectable()
export class SweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SweeperService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly reservations: ReservationsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.reservations
        .expireStale()
        .then(({ expired, completed }) => {
          if (expired > 0 || completed > 0) {
            this.logger.log(`Sweeper: ${expired} reserva(s) vencida(s), ${completed} completada(s), mesas liberadas`);
          }
        })
        .catch((err) => this.logger.error(`Sweeper error: ${err.message}`));
    }, 30_000);
    // Primer barrido al arrancar (recupera vencidas durante el downtime)
    this.reservations.expireStale().catch(() => undefined);
    this.logger.log('Sweeper de reservas activo (cada 30s)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}