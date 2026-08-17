import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { CartService } from '../services/cart.service';
import { ToastService } from '../services/toast.service';
import { DietChipComponent, EmptyStateComponent } from '../components/shared';
import { ALERGEN_LABELS, MenuItem } from '../models';

@Component({
  selector: 'app-plato-detalle',
  standalone: true,
  imports: [RouterLink, DietChipComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="alert alert-info">Cargando plato…</div>
    } @else if (error()) {
      <app-empty icon="🍽️" title="Plato no disponible" subtitle="Puede que lo hayamos retirado de la carta hoy.">
        <a routerLink="/carta" class="btn btn-secondary">Volver a la carta</a>
      </app-empty>
    } @else if (dish(); as d) {
      <div class="dish-detail">
        <div class="dish-detail-img">
          @if (d.imagenUrl) {
            <img [src]="d.imagenUrl" [alt]="d.nombre" />
          } @else {
            <div class="dish-img dish-img-fallback">🍽️</div>
          }
        </div>
        <div class="dish-detail-info">
          <a routerLink="/carta" class="btn btn-ghost btn-sm" style="margin-bottom:16px">← Volver a la carta</a>
          <h2>{{ d.nombre }}</h2>
          <p class="dish-detail-desc">{{ d.descripcion }}</p>

          <div class="detail-row">
            <span>Precio</span>
            <span class="dish-price">{{ (d.precioCents / 100).toFixed(2).replace('.', ',') }} €</span>
          </div>
          <div class="detail-row">
            <span>Tiempo estimado</span>
            <span>≈ {{ d.tiempoMedioMin }} min</span>
          </div>
          <div class="detail-row">
            <span>Dietas</span>
            <div class="dish-tags">
              @for (t of d.tags; track t) {
                <app-diet-chip [tag]="t" />
              }
              @if (d.picante) {
                <app-diet-chip tag="picante" />
              }
              @if (d.tags.length === 0 && !d.picante) {
                <span class="chip">Sin etiquetas</span>
              }
            </div>
          </div>
          @if (d.alergenos.length > 0) {
            <div class="detail-row">
              <span>Alérgenos</span>
              <div class="allergen-list">
                @for (a of d.alergenos; track a) {
                  <app-diet-chip [tag]="a" [label]="ALERGEN_LABELS[a] ?? a" />
                }
              </div>
            </div>
          }

          <div style="margin-top:24px; display:flex; gap:12px; flex-wrap:wrap">
            <button class="btn btn-primary" (click)="add()">+ Añadir al pedido</button>
            <a routerLink="/carta" class="btn btn-ghost">Seguir mirando</a>
          </div>
          @if (added()) {
            <div class="alert alert-info" style="margin-top:16px">Añadido a tu pedido · <a routerLink="/pedir">Ir a mi mesa →</a></div>
          }
        </div>
      </div>
    }
  `,
})
export class PlatoDetallePage {
  private readonly route = inject(ActivatedRoute);
  private readonly menu = inject(MenuService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly dish = signal<MenuItem | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly added = signal(false);
  readonly ALERGEN_LABELS = ALERGEN_LABELS;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    void this.load(id ?? '');
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const d = await this.menu.detail(id);
      this.dish.set(d);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  add(): void {
    const d = this.dish();
    if (!d) return;
    this.cart.add({ id: d.id, nombre: d.nombre, precioCents: d.precioCents, imagenUrl: d.imagenUrl });
    this.added.set(true);
    this.toast.show(`${d.nombre} añadido`, 'success', 2000);
  }
}