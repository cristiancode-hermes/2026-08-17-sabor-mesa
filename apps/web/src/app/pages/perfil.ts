import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService, LoyaltyService } from '../services/loyalty.service';
import { EmptyStateComponent } from '../components/shared';
import { ORDER_STATUS_LABELS, ProfileDTO, LoyaltyEntry } from '../models';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="alert alert-info">Cargando tu perfil…</div>
    } @else if (profile(); as p) {
      <h1 style="font-size:1.9rem; margin-bottom:4px">Hola, {{ p.user.nombre }} 👋</h1>
      <p style="color:var(--ink-muted); margin-bottom:24px">{{ p.user.email }}</p>

      <div class="loyalty-card">
        <div>
          <div class="loyalty-points">{{ p.user.puntosAcumulados }}</div>
          <div style="font-size:0.85rem; color:var(--ink-muted)">puntos de fidelidad</div>
        </div>
        <div>
          <p class="loyalty-rule">Ganas <strong>1 punto por cada 10 €</strong> en tus pedidos.</p>
          <p class="loyalty-rule">Has gastado <strong>{{ (p.stats.totalGastadoCents / 100).toFixed(2).replace('.', ',') }} €</strong> en {{ p.stats.totalPedidos }} pedidos.</p>
        </div>
      </div>

      <h2 style="margin-bottom:12px">Mis pedidos</h2>
      @if (p.pedidos.length === 0) {
        <app-empty icon="🍽️" title="Aún no has pedido" subtitle="Escanea el QR de tu mesa o pide desde la carta.">
          <a routerLink="/carta" class="btn btn-primary">Ver la carta</a>
        </app-empty>
      } @else {
        @for (ped of p.pedidos; track ped.id) {
          <div class="list-card">
            <div>
              <div class="list-card-title">Mesa {{ ped.mesa }} · <span style="font-family:var(--font-mono)">{{ ped.numero }}</span></div>
              <div class="list-card-sub">{{ ped.itemsCount }} platos · {{ (ped.totalCents / 100).toFixed(2).replace('.', ',') }} €</div>
            </div>
            <div style="display:flex; align-items:center; gap:12px">
              <span class="badge badge-{{ ped.estado }}">{{ ORDER_STATUS_LABELS[ped.estado] }}</span>
              <span class="points-badge">+{{ ped.puntosGanados }} pts</span>
            </div>
          </div>
        }
      }

      <h2 style="margin:24px 0 12px">Mis reservas</h2>
      @if (p.reservas.length === 0) {
        <app-empty icon="📅" title="Sin reservas" subtitle="Reserva tu próxima visita en un minuto.">
          <a routerLink="/reservar" class="btn btn-secondary">Reservar mesa</a>
        </app-empty>
      } @else {
        @for (r of p.reservas; track r.id) {
          <div class="list-card">
            <div>
              <div class="list-card-title">Mesa {{ r.table?.numero ?? '—' }} · {{ r.fechaReserva }} {{ r.horaInicio }}</div>
              <div class="list-card-sub">{{ r.numComensales }} comensales</div>
            </div>
            <span class="badge badge-{{ r.estado }}">{{ r.estado }}</span>
          </div>
        }
      }

      <h2 style="margin:24px 0 12px">Movimientos de puntos</h2>
      @if (ledger().length === 0) {
        <p style="color:var(--ink-muted)">Tus puntos aparecerán aquí cuando pagues tu primera cuenta.</p>
      } @else {
        @for (e of ledger(); track e.id) {
          <div class="list-card">
            <div>
              <div class="list-card-title">{{ e.concepto === 'PEDIDO' ? 'Pedido cobrado' : e.concepto }}</div>
              <div class="list-card-sub">Base: {{ (e.totalRecomCents / 100).toFixed(2).replace('.', ',') }} € · {{ fmtDate(e.ts) }}</div>
            </div>
            <span class="points-badge">+{{ e.delta }} pts</span>
          </div>
        }
      }
    }
  `,
})
export class PerfilPage {
  private readonly profileSvc = inject(ProfileService);
  private readonly loyalty = inject(LoyaltyService);

  readonly profile = signal<ProfileDTO | null>(null);
  readonly ledger = signal<LoyaltyEntry[]>([]);
  readonly loading = signal(true);
  readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const [p, l] = await Promise.all([this.profileSvc.profile(), this.loyalty.ledger()]);
      this.profile.set(p);
      this.ledger.set(l);
    } finally {
      this.loading.set(false);
    }
  }

  fmtDate(ts: string): string {
    return new Date(ts).toLocaleString('es-ES');
  }
}