import { Component, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrdersService } from '../services/orders.service';
import { ToastService } from '../services/toast.service';
import { OrderStepperComponent, EmptyStateComponent } from '../components/shared';
import { MenuOrder, ORDER_STATUS_LABELS } from '../models';

@Component({
  selector: 'app-mesa',
  standalone: true,
  imports: [RouterLink, OrderStepperComponent, EmptyStateComponent],
  template: `
    <div class="tracking-card">
      @if (order(); as o) {
        <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px">
          <h2>Mesa <span class="tracking-mesa">{{ o.mesa }}</span></h2>
          <span class="badge badge-{{ o.estado }}">{{ ORDER_STATUS_LABELS[o.estado] }}</span>
        </div>
        <p style="color:var(--ink-muted); font-size:0.85rem; margin-top:4px">Pedido <span style="font-family:var(--font-mono)">{{ o.numero }}</span></p>

        <app-order-stepper [current]="o.estado" />

        <div class="dish-status-list">
          @for (d of o.dishStatuses ?? []; track d.id) {
            <div class="dish-status" [class.dish-status-servido]="d.estadoPlato === 'SERVIDO'">
              <span class="dish-status-dot"></span>
              <span class="dish-status-name">{{ d.nombre }}</span>
              <span style="font-size:0.8rem; color:var(--ink-muted)">
                {{ d.estadoPlato === 'SERVIDO' ? 'Servido ✓' : d.estadoPlato === 'EN_PREPARACION' ? 'Preparando…' : 'En cola' }}
              </span>
            </div>
          }
        </div>

        @if (o.notaMesa) {
          <p style="font-size:0.85rem; color:var(--warning); font-style:italic; margin-bottom:16px">Nota: {{ o.notaMesa }}</p>
        }

        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px">
          <button class="btn btn-ghost" (click)="goCarta()">Añadir más platos</button>
          @if (o.estado === 'SERVIDO') {
            <button class="btn btn-primary" (click)="pedirCuenta()">Pedir la cuenta · {{ (o.totalCents / 100).toFixed(2).replace('.', ',') }} €</button>
          }
          @if (o.estado === 'COBRADO') {
            <a routerLink="/pago" class="btn btn-primary">Ver comprobante</a>
          }
        </div>
      } @else if (loading()) {
        <div class="alert alert-info">Buscando el pedido de tu mesa…</div>
      } @else {
        <app-empty icon="🪑" title="Esta mesa no tiene pedido en curso" subtitle="Escanea el código QR de la mesa o añade platos desde la carta.">
          <a routerLink="/carta" class="btn btn-primary">Ir a la carta</a>
        </app-empty>
      }
    </div>
  `,
})
export class MesaPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly order = signal<MenuOrder | null>(null);
  readonly loading = signal(true);
  readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;

  private mesa = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onVis = (): void => {
    if (!document.hidden) void this.refresh();
  };

  constructor() {
    this.mesa = this.route.snapshot.paramMap.get('numero') ?? '';
    void this.refresh();
    // Polling cada 5s + resync al volver a la pestaña (el setInterval se congela en pestaña inactiva)
    this.timer = setInterval(() => void this.refresh(), 5000);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('focus', this.onVis);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('focus', this.onVis);
  }

  async refresh(): Promise<void> {
    try {
      const o = await this.orders.refreshTable(this.mesa);
      this.order.set(o);
    } catch {
      // silencioso — el polling reintenta
    } finally {
      this.loading.set(false);
    }
  }

  goCarta(): void {
    void this.router.navigate(['/carta']);
  }

  pedirCuenta(): void {
    this.toast.show('Cuenta solicitada — el camarero cerrará tu mesa', 'info');
    void this.router.navigate(['/pago'], { state: { orderId: this.order()?.id } });
  }
}