import { Component, inject, signal, computed } from '@angular/core';
import { ManagerService } from '../services/loyalty.service';
import { TablesService, ReservationsService } from '../services/tables.service';
import { TableTileComponent, EmptyStateComponent } from '../components/shared';
import { ManagerStats, RevenuePoint, TableDTO, TABLE_STATUS_LABELS, Reservation } from '../models';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-salon',
  standalone: true,
  imports: [TableTileComponent, EmptyStateComponent],
  template: `
    <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:12px; margin-bottom:24px">
      <div>
        <h1 style="font-size:1.9rem">El salón 🍽️</h1>
        <p style="color:var(--ink-muted)">Estado de mesas en tiempo real</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center">
        <input type="date" class="input" style="min-height:38px" [value]="fecha()" (change)="fecha.set($any($event.target).value); loadStats()" />
        <button class="btn btn-ghost btn-sm" (click)="loadAll()">↻</button>
      </div>
    </div>

    @if (stats(); as s) {
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Ingresos</div>
          <div class="stat-value">{{ (s.ingresosCents / 100).toFixed(2).replace('.', ',') }} €</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pedidos</div>
          <div class="stat-value">{{ s.pedidos }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Platos servidos</div>
          <div class="stat-value">{{ s.platosServidos }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ticket medio</div>
          <div class="stat-value">{{ (s.ticketMedioCents / 100).toFixed(2).replace('.', ',') }} €</div>
        </div>
      </div>

      <div class="chart-wrap" style="margin-bottom:32px">
        <h3 class="chart-title">Ingresos por hora · {{ s.fecha }}</h3>
        <svg class="chart-svg" [attr.viewBox]="viewBox()" role="img" aria-label="Gráfico de ingresos por hora">
          <!-- Eje X: líneas y etiquetas de hora -->
          @for (tick of xTicks(); track tick) {
            <line [attr.x1]="x(tick)" [attr.x2]="x(tick)" y1="8" [attr.y2]="chartH - 24" class="axis-line" />
            <text [attr.x]="x(tick)" [attr.y]="chartH - 8" text-anchor="middle" class="axis-label">{{ tick }}h</text>
          }
          <!-- Eje Y: etiquetas -->
          @for (t of yTicks(); track t) {
            <text [attr.x]="0" [attr.y]="y(t) + 4" class="axis-label">{{ t }}</text>
          }
          <!-- Barras -->
          @for (p of revenue(); track p.hora) {
            <g>
              <rect
                class="chart-bar"
                [attr.x]="barX(p.hora)"
                [attr.y]="y(p.totalCents)"
                [attr.width]="barW()"
                [attr.height]="barH(p.totalCents)"
                rx="4"
                fill="var(--primary)"
                (mouseenter)="hover.set(p)"
                (mouseleave)="hover.set(null)"
              />
            </g>
          }
          <!-- Línea base -->
          <line [attr.x1]="0" [attr.x2]="chartW" [attr.y1]="chartH - 24" [attr.y2]="chartH - 24" class="axis-line" />
        </svg>

        @if (hover(); as h) {
          <div class="chart-tooltip" [style.left.%]="tooltipLeft(h.hora)" [style.top.%]="tooltipTop(h.totalCents)">
            {{ h.hora }} · <strong>{{ (h.totalCents / 100).toFixed(2).replace('.', ',') }} €</strong> ({{ h.pedidos }} pedido{{ h.pedidos === 1 ? '' : 's' }})
          </div>
        }
        @if (revenue().every((p) => p.totalCents === 0)) {
          <p style="text-align:center; color:var(--ink-muted); font-size:0.85rem; margin-top:8px">
            Sin actividad registrada el {{ s.fecha }}. Elige otra fecha.
          </p>
        }
      </div>
    }

    <h2 style="margin-bottom:12px">Mesas del salón</h2>
    <div class="salon-grid">
      @for (t of tables(); track t.id) {
        <app-table-tile [table]="t" (selected)="selectTable($event)" />
      }
    </div>

    @if (selectedTable(); as sel) {
      <div class="tracking-card" style="margin-bottom:32px">
        <h3 style="margin-bottom:12px">Mesa {{ sel.numero }} · {{ TABLE_STATUS_LABELS[sel.estado] }}</h3>
        <div class="detail-row"><span>Capacidad</span><span>{{ sel.capacidad }} personas</span></div>
        <div class="detail-row"><span>Ubicación</span><span>{{ sel.ubicacion }}</span></div>
        <div class="detail-row"><span>Estado</span><span class="badge badge-{{ sel.estado }}">{{ TABLE_STATUS_LABELS[sel.estado] }}</span></div>
        @if (reservationsOf(sel.numero); as res) {
          <p style="margin-top:12px; font-size:0.85rem; color:var(--ink-muted)">
            📅 {{ res.fechaReserva }} {{ res.horaInicio }} · {{ res.numComensales }} pers. · <span class="badge badge-{{ res.estado }}">{{ res.estado }}</span>
          </p>
          @if (res.estado === 'PENDIENTE') {
            <button class="btn btn-secondary btn-sm" style="margin-top:8px" (click)="confirmRes(res.id)">Confirmar reserva</button>
          }
        }
      </div>
    }

    <h2 style="margin:24px 0 12px">Reservas de {{ fecha() }}</h2>
    @if (reservas().length === 0) {
      <app-empty icon="📅" title="Sin reservas este día" subtitle="Las reservas pendientes de confirmar aparecen aquí." />
    } @else {
      <div style="display:flex; flex-direction:column; gap:12px">
        @for (r of reservas(); track r.id) {
          <div class="list-card">
            <div>
              <div class="list-card-title">Mesa {{ r.table?.numero ?? '—' }} · {{ r.horaInicio }}</div>
              <div class="list-card-sub">{{ r.numComensales }} comensales</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center">
              <span class="badge badge-{{ r.estado }}">{{ r.estado }}</span>
              @if (r.estado === 'PENDIENTE') {
                <button class="btn btn-secondary btn-sm" (click)="confirmRes(r.id)">Confirmar</button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SalonPage {
  private readonly manager = inject(ManagerService);
  private readonly tablesSvc = inject(TablesService);
  private readonly reservations = inject(ReservationsService);

  readonly fecha = signal(todayStr());
  readonly stats = signal<ManagerStats | null>(null);
  readonly revenue = signal<RevenuePoint[]>([]);
  readonly tables = signal<TableDTO[]>([]);
  readonly reservas = signal<Reservation[]>([]);
  readonly selectedTable = signal<TableDTO | null>(null);
  readonly hover = signal<RevenuePoint | null>(null);
  readonly TABLE_STATUS_LABELS = TABLE_STATUS_LABELS;

  // Dimensiones del gráfico
  readonly chartW = 760;
  readonly chartH = 260;
  readonly maxY = computed(() => Math.max(1, ...this.revenue().map((p) => p.totalCents)));

  readonly viewBox = computed(() => `0 0 ${this.chartW} ${this.chartH}`);
  readonly xTicks = computed(() => this.revenue().map((p) => Number(p.hora.split(':')[0])));
  readonly yTicks = computed(() => {
    const max = this.maxY();
    const step = Math.max(500, Math.ceil(max / 4 / 100) * 100);
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    return ticks;
  });

  constructor() {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadStats(), this.loadTables(), this.loadReservas()]);
  }

  async loadStats(): Promise<void> {
    try {
      const [s, r] = await Promise.all([this.manager.stats(this.fecha()), this.manager.revenue(this.fecha())]);
      this.stats.set(s);
      this.revenue.set(r);
      // Si hoy aún no tiene actividad (p.ej. a primera hora), muestra ayer automáticamente
      if (r.every((p) => p.totalCents === 0)) {
        const yesterday = inDays(-1);
        if (this.fecha() !== yesterday) {
          this.fecha.set(yesterday);
          const [s2, r2] = await Promise.all([this.manager.stats(yesterday), this.manager.revenue(yesterday)]);
          this.stats.set(s2);
          this.revenue.set(r2);
        }
      }
    } catch {
      // sin datos
    }
  }

  async loadTables(): Promise<void> {
    try {
      this.tables.set(await this.tablesSvc.all());
    } catch {
      // sin datos
    }
  }

  async loadReservas(): Promise<void> {
    try {
      this.reservas.set(await this.reservations.mine());
    } catch {
      // sin datos
    }
  }

  x(hora: number): number {
    const min = Math.min(...this.xTicks());
    const max = Math.max(...this.xTicks());
    const span = Math.max(1, max - min);
    return 40 + ((hora - min) / span) * (this.chartW - 80);
  }

  y(cents: number): number {
    return this.chartH - 24 - this.barH(cents);
  }

  barH(cents: number): number {
    return Math.max(2, (cents / this.maxY()) * (this.chartH - 48));
  }

  barX(hora: string): number {
    return this.x(Number(hora.split(':')[0])) - this.barW() / 2;
  }

  readonly barW = () => Math.min(28, (this.chartW - 80) / Math.max(1, this.xTicks().length) - 4);

  tooltipLeft(hora: string): number {
    return (this.x(Number(hora.split(':')[0])) / this.chartW) * 100;
  }

  tooltipTop(cents: number): number {
    return ((this.y(cents) - 10) / this.chartH) * 100;
  }

  selectTable(t: TableDTO): void {
    this.selectedTable.set(t);
  }

  reservationsOf(numero: string): Reservation | undefined {
    return this.reservas().find((r) => r.table?.numero === numero && (r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA'));
  }

  async confirmRes(id: string): Promise<void> {
    try {
      await this.reservations.confirm(id);
      await Promise.all([this.loadReservas(), this.loadTables()]);
    } catch {
      // 409 si venció
      await Promise.all([this.loadReservas(), this.loadTables()]);
    }
  }
}