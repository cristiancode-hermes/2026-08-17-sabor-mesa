import { Component, input, output } from '@angular/core';
import { MenuItem, TableDTO } from '../models';

/** Chip de dieta/alérgeno. */
@Component({
  selector: 'app-diet-chip',
  standalone: true,
  template: `
    <span class="chip" [class.chip-vegan]="tag() === 'vegano'" [class.chip-gluten]="tag() === 'sinGluten'" [class.chip-spicy]="tag() === 'picante'">
      @if (tag() === 'picante') {
        🌶️ Picante
      } @else {
        {{ tag() === 'vegano' ? 'Vegano' : tag() === 'sinGluten' ? 'Sin gluten' : label() }}
      }
    </span>
  `,
})
export class DietChipComponent {
  readonly tag = input.required<string>();
  readonly label = input('');
}

/** Estado vacío reutilizable. */
@Component({
  selector: 'app-empty',
  standalone: true,
  template: `
    <div class="empty">
      <div class="empty-icon">{{ icon() }}</div>
      <p class="empty-title">{{ title() }}</p>
      @if (subtitle()) {
        <p class="empty-sub">{{ subtitle() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('🍽️');
  readonly title = input('Sin contenido');
  readonly subtitle = input('');
}

/** Skeleton de carga. */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div class="skeleton-grid">
      @for (i of [].constructor(rows()); track i) {
        <div class="skeleton-card">
          <div class="skeleton skeleton-img"></div>
          <div class="skeleton skeleton-line w-70"></div>
          <div class="skeleton skeleton-line w-40"></div>
        </div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  readonly rows = input(4);
}

/** Stepper de estados del pedido (ENVIADO→EN_COCINA→SERVIDO→COBRADO). */
@Component({
  selector: 'app-order-stepper',
  standalone: true,
  template: `
    <ol class="stepper">
      @for (step of steps(); track step.estado) {
        <li class="step" [class.step-active]="step.estado === current()" [class.step-done]="stepIndex(step.estado) < stepIndex(current())">
          <span class="step-dot"></span>
          <span class="step-label">{{ step.label }}</span>
        </li>
      }
    </ol>
  `,
})
export class OrderStepperComponent {
  readonly current = input.required<string>();
  readonly steps = input<{ estado: string; label: string }[]>([
    { estado: 'ENVIADO', label: 'Enviado' },
    { estado: 'EN_COCINA', label: 'En cocina' },
    { estado: 'SERVIDO', label: 'Servido' },
    { estado: 'COBRADO', label: 'Cobrado' },
  ]);

  stepIndex(estado: string): number {
    return this.steps().findIndex((s) => s.estado === estado);
  }
}

/** Tile de mesa del salón. */
@Component({
  selector: 'app-table-tile',
  standalone: true,
  template: `
    <button class="table-tile table-{{ table().estado }}" (click)="selected.emit(table())">
      <span class="table-num">{{ table().numero }}</span>
      <span class="table-cap">{{ table().capacidad }} pers.</span>
      <span class="table-loc">{{ table().ubicacion }}</span>
    </button>
  `,
})
export class TableTileComponent {
  readonly table = input.required<TableDTO>();
  readonly selected = output<TableDTO>();
}

/** Card de plato de la carta. */
@Component({
  selector: 'app-dish-card',
  standalone: true,
  imports: [DietChipComponent],
  template: `
    <article class="dish-card" (click)="open.emit(dish())">
      <div class="dish-img-wrap">
        @if (dish().imagenUrl) {
          <img [src]="dish().imagenUrl" [alt]="dish().nombre" class="dish-img" />
        } @else {
          <div class="dish-img dish-img-fallback">🍽️</div>
        }
        @if (dish().picante) {
          <span class="dish-spicy-badge">🌶️</span>
        }
      </div>
      <div class="dish-body">
        <h3 class="dish-name">{{ dish().nombre }}</h3>
        <p class="dish-desc">{{ dish().descripcion }}</p>
        <div class="dish-tags">
          @for (t of dish().tags; track t) {
            <app-diet-chip [tag]="t" />
          }
        </div>
        <div class="dish-foot">
          <span class="dish-price">{{ (dish().precioCents / 100).toFixed(2).replace('.', ',') }} €</span>
          <button class="btn btn-primary btn-sm" (click)="add.emit(dish()); $event.stopPropagation()">+ Añadir</button>
        </div>
      </div>
    </article>
  `,
})
export class DishCardComponent {
  readonly dish = input.required<MenuItem>();
  readonly add = output<MenuItem>();
  readonly open = output<MenuItem>();
}