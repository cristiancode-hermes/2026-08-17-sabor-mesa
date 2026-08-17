import { Component, inject, signal, OnDestroy } from '@angular/core';
import { OrdersService } from '../services/orders.service';
import { ToastService } from '../services/toast.service';
import { EmptyStateComponent } from '../components/shared';
import { MenuOrder } from '../models';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:24px; flex-wrap:wrap; gap:8px">
      <h1 style="font-size:1.9rem">Cocina 🍳</h1>
      <span style="color:var(--ink-muted); font-size:0.9rem">Actualizado en vivo · {{ lastUpdate() }}</span>
    </div>

    @if (items().length === 0) {
      <app-empty icon="🍳" title="Aún no hay pedidos en cocina" subtitle="Los pedidos de las mesas aparecerán aquí al instante." />
    } @else {
      <div class="kitchen-grid">
        @for (o of items(); track o.id) {
          <div class="kitchen-card" [class.is-new]="isNew(o)">
            <div class="kitchen-head">
              <span class="kitchen-mesa">Mesa {{ o.mesa }}</span>
              <span class="kitchen-timer">{{ elapsed(o) }}</span>
            </div>
            <span class="badge badge-{{ o.estado }}">{{ o.estado === 'EN_COCINA' ? 'En cocina' : 'Nuevo' }}</span>
            @for (d of o.dishStatuses ?? []; track d.id) {
              <div class="kitchen-dish">
                <span class="kitchen-dish-name">{{ d.nombre }}</span>
                <span class="kitchen-dish-qty">{{ qtyOf(o, d.menuItemId) }}</span>
                <button
                  class="btn btn-secondary btn-sm"
                  [disabled]="d.estadoPlato === 'SERVIDO'"
                  (click)="serve(o, d.menuItemId)"
                >
                  {{ d.estadoPlato === 'SERVIDO' ? 'Servido ✓' : 'Servir' }}
                </button>
              </div>
            }
            @if (o.notaMesa) {
              <p class="kitchen-note">📝 {{ o.notaMesa }}</p>
            }
            @if (o.estado === 'ENVIADO') {
              <button class="btn btn-ghost btn-sm" style="margin-top:12px; width:100%" (click)="start(o)">Comenzar preparación</button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class CocinaPage implements OnDestroy {
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly list = signal<MenuOrder[]>([]);
  readonly lastUpdate = signal('—');
  private knownIds = new Set<string>();

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onVis = (): void => {
    if (!document.hidden) void this.refresh();
  };

  constructor() {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 4000);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('focus', this.onVis);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('focus', this.onVis);
  }

  items() {
    return this.list();
  }

  async refresh(): Promise<void> {
    try {
      const list = await this.orders.activeKitchen();
      // Detectar pedidos nuevos para el banner
      for (const o of list) {
        if (!this.knownIds.has(o.id) && o.estado === 'ENVIADO') {
          this.toast.show(`Nuevo pedido de la mesa ${o.mesa}`, 'info', 3000);
        }
        this.knownIds.add(o.id);
      }
      this.list.set(list);
      this.lastUpdate.set(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      // silencioso
    }
  }

  isNew(o: MenuOrder): boolean {
    return o.estado === 'ENVIADO';
  }

  elapsed(o: MenuOrder): string {
    const mins = Math.max(1, Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000));
    return `${mins} min`;
  }

  qtyOf(o: MenuOrder, menuItemId: string): number {
    return o.items.find((i) => i.menuItemId === menuItemId)?.qty ?? 1;
  }

  async serve(o: MenuOrder, menuItemId: string): Promise<void> {
    try {
      const updated = await this.orders.serveDish(o.id, menuItemId);
      this.toast.show(`Plato servido de la mesa ${o.mesa}`, 'success', 2000);
      if (updated.estado === 'SERVIDO') {
        this.toast.show(`Pedido de la mesa ${o.mesa} completado — servido ✓`, 'success');
      }
      await this.refresh();
    } catch {
      this.toast.show('No se pudo marcar el plato', 'error');
    }
  }

  async start(o: MenuOrder): Promise<void> {
    try {
      await this.orders.transition(o.id, 'EN_COCINA');
      await this.refresh();
    } catch {
      this.toast.show('No se pudo iniciar la preparación', 'error');
    }
  }
}