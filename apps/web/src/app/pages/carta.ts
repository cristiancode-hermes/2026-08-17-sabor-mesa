import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { CartService } from '../services/cart.service';
import { ToastService } from '../services/toast.service';
import { DishCardComponent, SkeletonComponent, EmptyStateComponent } from '../components/shared';
import { Category, MenuItem } from '../models';

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [RouterLink, DishCardComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    <section class="hero">
      <p class="hero-kicker">Cocina mediterránea · Valencia</p>
      <h1 class="hero-title">La carta de hoy,<br />directa a tu mesa</h1>
      <p class="hero-sub">
        Escanea el código de tu mesa, elige de nuestra carta de temporada y envíalo a cocina.
        Sin llamar al camarero, sin esperas.
      </p>
    </section>

    @if (menu.loading()) {
      <app-skeleton [rows]="4" />
    } @else if (menu.error()) {
      <div class="alert alert-error">{{ menu.error() }}</div>
    } @else {
      <div class="filter-bar">
        <button class="filter-btn" [class.active]="!category()" (click)="setCategory('')">Todo</button>
        @for (cat of menu.categories(); track cat.id) {
          <button class="filter-btn" [class.active]="category() === cat.id" (click)="setCategory(cat.id)">
            {{ cat.icono }} {{ cat.nombre }}
          </button>
        }
        <span style="flex:1"></span>
        <button class="filter-btn" [class.active]="vegan()" (click)="toggleVegan()">🌱 Vegano</button>
        <button class="filter-btn" [class.active]="glutenFree()" (click)="toggleGluten()">🚫 Sin gluten</button>
      </div>

      @if (filtered().length === 0) {
        <app-empty icon="🥗" title="Ningún plato coincide" subtitle="Prueba a quitar los filtros de dieta para ver toda la carta.">
          <button class="btn btn-secondary btn-sm" (click)="clearFilters()">Limpiar filtros</button>
        </app-empty>
      } @else {
        @for (cat of grouped(); track cat.id) {
          <section class="menu-section">
            <h2 class="menu-section-title">
              <span class="menu-section-icon">{{ cat.icono }}</span>
              {{ cat.nombre }}
            </h2>
            <div class="dish-grid">
              @for (dish of cat.dishes; track dish.id) {
                <app-dish-card [dish]="dish" (add)="addToCart($event)" (open)="openDish($event)" />
              }
            </div>
          </section>
        }
      }
    }

    @if (cart.count() > 0) {
      <div class="cart-bar">
        <span class="cart-bar-total">{{ cart.count() }} platos · {{ (cart.totalCents() / 100).toFixed(2).replace('.', ',') }} €</span>
        <a routerLink="/pedir" class="btn btn-primary btn-sm">Ir a mi mesa →</a>
      </div>
    }
  `,
})
export class CartaPage {
  public menu = inject(MenuService);
  public cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly category = signal('');
  readonly vegan = signal(false);
  readonly glutenFree = signal(false);

  constructor() {
    void this.menu.load();
  }

  setCategory(id: string): void {
    this.category.set(id);
    void this.menu.load({ categoryId: id, vegan: this.vegan(), glutenFree: this.glutenFree() });
  }

  toggleVegan(): void {
    this.vegan.set(!this.vegan());
    void this.menu.load({ categoryId: this.category(), vegan: this.vegan(), glutenFree: this.glutenFree() });
  }

  toggleGluten(): void {
    this.glutenFree.set(!this.glutenFree());
    void this.menu.load({ categoryId: this.category(), vegan: this.vegan(), glutenFree: this.glutenFree() });
  }

  clearFilters(): void {
    this.category.set('');
    this.vegan.set(false);
    this.glutenFree.set(false);
    void this.menu.load();
  }

  readonly filtered = computed(() => this.menu.items());

  readonly grouped = computed(() =>
    this.menu
      .categories()
      .map((cat: Category) => ({
        ...cat,
        dishes: this.filtered().filter((d) => d.categoryId === cat.id),
      }))
      .filter((g) => g.dishes.length > 0),
  );

  addToCart(dish: MenuItem): void {
    this.cart.add({ id: dish.id, nombre: dish.nombre, precioCents: dish.precioCents, imagenUrl: dish.imagenUrl });
    this.toast.show(`${dish.nombre} añadido a tu pedido`, 'success', 2000);
  }

  openDish(dish: MenuItem): void {
    void this.router.navigate(['/plato', dish.id]);
  }
}