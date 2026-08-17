import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';
import { OrdersService } from '../services/orders.service';
import { ToastService } from '../services/toast.service';
import { EmptyStateComponent } from '../components/shared';

@Component({
  selector: 'app-pedir',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    <h1 style="font-size:1.9rem; margin-bottom:24px">Tu pedido a mesa</h1>

    @if (cart.count() === 0) {
      <app-empty icon="🧺" title="Tu pedido está vacío" subtitle="Echa un vistazo a la carta y añade algo rico.">
        <a routerLink="/carta" class="btn btn-primary">Ver la carta</a>
      </app-empty>
    } @else {
      <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:24px; align-items:start" class="pedir-grid">
        <div>
          <div class="cart-lines">
            @for (line of cart.lines(); track line.menuItemId) {
              <div class="cart-line">
                <div class="cart-line-info">
                  <div class="cart-line-name">{{ line.nombre }}</div>
                  <div class="cart-line-price">{{ (line.precioUnitarioCents / 100).toFixed(2).replace('.', ',') }} €</div>
                  <input
                    class="input"
                    style="margin-top:6px; min-height:36px; font-size:0.85rem"
                    placeholder="Nota (sin cebolla, al punto…)"
                    [value]="line.nota ?? ''"
                    (change)="setNota(line.menuItemId, $any($event.target).value)"
                  />
                </div>
                <div class="qty-stepper">
                  <button class="qty-btn" (click)="cart.setQty(line.menuItemId, line.qty - 1)">−</button>
                  <span class="qty-val">{{ line.qty }}</span>
                  <button class="qty-btn" (click)="cart.setQty(line.menuItemId, line.qty + 1)">+</button>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="tracking-card" style="margin:0">
          <h3 style="margin-bottom:16px">Número de mesa</h3>
          <div class="field" style="margin-bottom:16px">
            <label for="mesa">¿En qué mesa estás sentado?</label>
            <input
              id="mesa"
              class="input"
              placeholder="M-5"
              [value]="mesa()"
              (input)="mesa.set($any($event.target).value)"
              autocomplete="off"
            />
          </div>
          <div class="field" style="margin-bottom:16px">
            <label for="notaMesa">Nota general (opcional)</label>
            <input id="notaMesa" class="input" placeholder="Cumpleaños, alergias…" [value]="notaMesa()" (input)="notaMesa.set($any($event.target).value)" />
          </div>

          <div class="detail-row">
            <span>Total</span>
            <span class="dish-price" style="font-size:1.25rem">{{ (cart.totalCents() / 100).toFixed(2).replace('.', ',') }} €</span>
          </div>
          @if (cart.totalCents() >= 1000) {
            <p style="font-size:0.8rem; color:var(--ink-muted); margin:8px 0 0">
              Ganas <strong>{{ points() }}</strong> punto{{ points() === 1 ? '' : 's' }} de fidelidad con este pedido
            </p>
          }

          @if (error()) {
            <div class="alert alert-error" style="margin-top:16px">{{ error() }}</div>
          }

          <button class="btn btn-primary btn-block" style="margin-top:16px" [disabled]="busy() || !mesa().trim()" (click)="submit()">
            {{ busy() ? 'Enviando a cocina…' : 'Enviar pedido a cocina' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class PedirPage {
  public cart = inject(CartService);
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly mesa = signal('');
  readonly notaMesa = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  readonly points = () => Math.floor(this.cart.totalCents() / 1000);

  setNota(menuItemId: string, nota: string): void {
    this.cart.setNota(menuItemId, nota);
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      const order = await this.orders.create({
        mesa: this.mesa().trim().toUpperCase(),
        items: this.cart.lines().map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, nota: l.nota })),
        notaMesa: this.notaMesa().trim() || undefined,
      });
      this.cart.clear();
      this.toast.show(`Pedido enviado a cocina · ${order.numero}`, 'success');
      void this.router.navigate(['/mesa', order.mesa]);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      if (msg?.includes('pedido en curso')) {
        this.error.set('Esta mesa ya tiene un pedido en curso. Revisa el seguimiento de tu mesa.');
      } else {
        this.error.set(msg ?? 'No se pudo enviar el pedido');
      }
    } finally {
      this.busy.set(false);
    }
  }
}