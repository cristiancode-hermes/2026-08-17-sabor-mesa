import { Component, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReservationsService } from '../services/tables.service';
import { ToastService } from '../services/toast.service';
import { EmptyStateComponent } from '../components/shared';
import { Reservation, RESERVATION_STATUS_LABELS } from '../models';
@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    @if (error()) {
      <app-empty icon="📅" title="Reserva no encontrada" subtitle="Comprueba el enlace o vuelve a reservar.">
        <a routerLink="/reservar" class="btn btn-primary">Reservar mesa</a>
      </app-empty>
    } @else if (res(); as r) {
      <div class="reservation-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
          <h2>Mesa {{ r.table?.numero ?? '—' }}</h2>
          <span class="badge badge-{{ r.estado }}">{{ RESERVATION_STATUS_LABELS[r.estado] }}</span>
        </div>

        <div style="margin:20px 0">
          <div class="detail-row"><span>Día</span><span>{{ r.fechaReserva }}</span></div>
          <div class="detail-row"><span>Hora</span><span>{{ r.horaInicio }} – {{ r.horaFin }}</span></div>
          <div class="detail-row"><span>Comensales</span><span>{{ r.numComensales }}</span></div>
          <div class="detail-row"><span>Ubicación</span><span>{{ r.table?.ubicacion ?? '—' }}</span></div>
        </div>

        @if (r.estado === 'PENDIENTE') {
          <p style="font-size:0.85rem; color:var(--ink-muted); text-align:center">
            Esperando confirmación del host. Si no se confirma, se libera automáticamente:
          </p>
          <div class="countdown">{{ countdown() }}</div>
          <button class="btn btn-danger btn-block" (click)="cancel()">Cancelar reserva</button>
        } @else if (r.estado === 'VENCIDA') {
          <div class="alert alert-error" style="text-align:center">
            Esta reserva venció y la mesa se ha liberado. Puedes reservar de nuevo.
          </div>
          <a routerLink="/reservar" class="btn btn-primary btn-block">Reservar otra mesa</a>
        } @else if (r.estado === 'CONFIRMADA') {
          <div class="alert alert-info" style="text-align:center">¡Reserva confirmada! Te esperamos el {{ r.fechaReserva }} a las {{ r.horaInicio }}.</div>
          <button class="btn btn-danger btn-block" (click)="cancel()">Cancelar reserva</button>
        }
      </div>
    } @else {
      <div class="alert alert-info">Cargando reserva…</div>
    }
  `,
})
export class ReservaDetallePage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly reservations = inject(ReservationsService);
  private readonly toast = inject(ToastService);

  readonly res = signal<Reservation | null>(null);
  readonly error = signal(false);
  readonly countdown = signal('--:--');
  readonly RESERVATION_STATUS_LABELS = RESERVATION_STATUS_LABELS;

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onVis = (): void => {
    if (!document.hidden) this.tick();
  };

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load(id);
    // Resync del countdown con Date.now() real al volver a la pestaña (el setInterval se congela)
    this.timer = setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('focus', this.onVis);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('focus', this.onVis);
  }

  async load(id: string): Promise<void> {
    try {
      const r = await this.reservations.detail(id);
      this.res.set(r);
      this.tick();
    } catch {
      this.error.set(true);
    }
  }

  tick(): void {
    const r = this.res();
    if (!r?.expiresAt || r.estado !== 'PENDIENTE') return;
    const left = new Date(r.expiresAt).getTime() - Date.now();
    if (left <= 0) {
      this.countdown.set('00:00');
      void this.refresh();
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    this.countdown.set(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }

  async refresh(): Promise<void> {
    const r = this.res();
    if (!r) return;
    try {
      this.res.set(await this.reservations.detail(r.id));
    } catch {
      this.error.set(true);
    }
  }

  async cancel(): Promise<void> {
    const r = this.res();
    if (!r) return;
    try {
      await this.reservations.cancel(r.id);
      this.toast.show('Reserva cancelada — mesa liberada', 'info');
      await this.refresh();
    } catch {
      this.toast.show('No se pudo cancelar la reserva', 'error');
    }
  }
}