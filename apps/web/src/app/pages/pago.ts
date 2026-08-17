import { Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrdersService } from '../services/orders.service';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { EmptyStateComponent } from '../components/shared';
import { MenuOrder, pointsFor } from '../models';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    @if (!order()) {
      <app-empty icon="💳" title="No hay cuenta que pagar" subtitle="Envía un pedido a tu mesa o pide la cuenta desde el seguimiento.">
        <a routerLink="/carta" class="btn btn-primary">Ver la carta</a>
      </app-empty>
    } @else if (!done()) {
      <div class="tracking-card">
        <h2 style="margin-bottom:8px">Tu cuenta · Mesa {{ order()!.mesa }}</h2>
        <p style="color:var(--ink-muted); margin-bottom:20px">Pedido <span style="font-family:var(--font-mono)">{{ order()!.numero }}</span></p>

        <div style="margin-bottom:20px">
          @for (item of order()!.items; track $index) {
            <div class="detail-row">
              <span>{{ item.qty }} × {{ item.nombre }}</span>
              <span>{{ ((item.precioUnitarioCents * item.qty) / 100).toFixed(2).replace('.', ',') }} €</span>
            </div>
          }
          <div class="detail-row" style="border-bottom:none; padding-top:16px">
            <span style="font-weight:700; font-size:1.1rem">Total</span>
            <span style="font-family:var(--font-mono); font-weight:700; font-size:1.3rem">{{ (order()!.totalCents / 100).toFixed(2).replace('.', ',') }} €</span>
          </div>
        </div>

        @if (order()!.totalCents >= 1000) {
          <p style="font-size:0.85rem; color:var(--ink-muted); margin-bottom:16px">
            Con este pago ganarás <strong>{{ points() }}</strong> punto{{ points() === 1 ? '' : 's' }} en tu tarjeta Sabor &amp; Mesa
          </p>
        }

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <button class="btn btn-primary btn-block" [disabled]="busy()" (click)="pay()">
          {{ busy() ? 'Procesando pago…' : 'Pagar ' + ((order()!.totalCents / 100).toFixed(2).replace('.', ',')) + ' €' }}
        </button>
        <p style="font-size:0.75rem; color:var(--ink-muted); text-align:center; margin-top:12px">
          Pago simulado para demo — no se cobra nada real. Recibirás un comprobante con QR.
        </p>
      </div>
    } @else {
      @if (result(); as r) {
        <div class="receipt">
          <h2 style="margin-bottom:4px">¡Gracias!</h2>
          <p style="color:var(--ink-muted)">Tu cuenta ha sido cobrada y la mesa queda libre.</p>

          <div class="receipt-qr" [innerHTML]="qrHtml()"></div>

          <p class="receipt-number">Comprobante · {{ r.comprobante.numero }}</p>
          <p class="receipt-total">{{ (r.order.totalCents / 100).toFixed(2).replace('.', ',') }} €</p>

          @if (r.puntosGanados > 0) {
            <span class="points-badge">⭐ +{{ r.puntosGanados }} puntos de fidelidad</span>
          }

          <div style="display:flex; gap:12px; justify-content:center; margin-top:24px; flex-wrap:wrap">
            <button class="btn btn-secondary" (click)="downloadReceipt()">⬇ Descargar QR</button>
            <button class="btn btn-ghost" (click)="sendEmail()">✉ Enviarme el comprobante</button>
          </div>
          @if (emailed()) {
            <p style="font-size:0.8rem; color:var(--success); margin-top:12px">Comprobante enviado a {{ auth.user()?.email }} (simulado)</p>
          }
          <div style="margin-top:16px">
            <a routerLink="/carta" class="btn btn-primary btn-block">Volver a la carta</a>
          </div>
        </div>
      }
    }
  `,
})
export class PagoPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);
  public auth = inject(AuthService);

  readonly order = signal<MenuOrder | null>(null);
  readonly result = signal<{ order: MenuOrder; comprobante: { qrSvg: string; numero: string }; puntosGanados: number } | null>(null);
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly error = signal('');
  readonly emailed = signal(false);
  readonly qrHtml = signal<SafeHtml>('');
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    const state = this.router.getCurrentNavigation()?.extras.state as { orderId?: string } | null;
    const orderId = state?.orderId ?? this.route.snapshot.queryParamMap.get('orderId');
    const mesa = this.route.snapshot.queryParamMap.get('mesa');
    void this.load(orderId, mesa);
  }

  async load(orderId: string | null, mesa: string | null): Promise<void> {
    try {
      if (orderId) {
        const o = await this.orders.detail(orderId);
        this.order.set(o);
        return;
      }
      if (mesa) {
        const o = await this.orders.refreshTable(mesa);
        this.order.set(o);
      }
    } catch {
      // sin pedido → empty state
    }
  }

  readonly points = () => (this.order() ? pointsFor(this.order()!.totalCents) : 0);

  async pay(): Promise<void> {
    const o = this.order();
    if (!o) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.orders.pay(o.id);
      this.result.set(r);
      this.qrHtml.set(this.sanitizer.bypassSecurityTrustHtml(r.comprobante.qrSvg));
      this.done.set(true);
      this.toast.show('Cuenta pagada — mesa liberada', 'success');
    } catch (e: unknown) {
      this.error.set((e as { error?: { message?: string } })?.error?.message ?? 'No se pudo procesar el pago');
    } finally {
      this.busy.set(false);
    }
  }

  downloadReceipt(): void {
    const r = this.result();
    if (!r) return;
    const blob = new Blob([r.comprobante.qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobante-${r.comprobante.numero}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('QR descargado', 'success', 2000);
  }

  sendEmail(): void {
    this.emailed.set(true);
    this.toast.show('Comprobante enviado por email (simulado)', 'success');
  }
}