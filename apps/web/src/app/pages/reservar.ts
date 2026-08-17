import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TablesService, ReservationsService } from '../services/tables.service';
import { ToastService } from '../services/toast.service';
import { EmptyStateComponent } from '../components/shared';
import { TableDTO } from '../models';

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
  selector: 'app-reservar',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  template: `
    <h1 style="font-size:1.9rem; margin-bottom:8px">Reserva tu mesa</h1>
    <p style="color:var(--ink-muted); margin-bottom:24px">Elige día, hora y cuántos seréis. La disponibilidad se comprueba en tiempo real.</p>

    <div class="reserve-form">
      <div class="field">
        <label for="fecha">Día</label>
        <input id="fecha" type="date" class="input" [min]="today()" [value]="fecha()" (change)="fecha.set($any($event.target).value); search()" />
      </div>
      <div class="field">
        <label for="hora">Hora</label>
        <select id="hora" class="select" [ngModel]="hora()" (ngModelChange)="hora.set($event); search()">
          @for (h of hours; track h) {
            <option [value]="h">{{ h }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="comensales">Comensales</label>
        <select id="comensales" class="select" [ngModel]="comensales()" (ngModelChange)="setComensales($event)">
          @for (c of [1, 2, 3, 4, 5, 6]; track c) {
            <option [value]="c">{{ c }} {{ c === 1 ? 'persona' : 'personas' }}</option>
          }
        </select>
      </div>
      <div style="display:flex; align-items:flex-end">
        <button class="btn btn-secondary" (click)="search()" [disabled]="loading()">Buscar mesas</button>
      </div>
    </div>

    @if (loading()) {
      <div class="alert alert-info">Consultando disponibilidad…</div>
    } @else if (searched() && tables().length === 0) {
      <app-empty icon="🪑" title="No hay mesas para ese horario" subtitle="Prueba otra hora o un día distinto — el servicio de comedor va de 13:00 a 23:00." />
    } @else if (tables().length > 0) {
      <h3 style="margin-bottom:12px">Mesas disponibles para {{ fecha() }} a las {{ hora() }}</h3>
      <div class="tables-grid">
        @for (t of tables(); track t.id) {
          <button
            class="table-tile table-LIBRE"
            [class.selected]="selected()?.id === t.id"
            style="border-color:{{ selected()?.id === t.id ? 'var(--primary)' : '' }}"
            (click)="select(t)"
          >
            <span class="table-num">{{ t.numero }}</span>
            <span class="table-cap">{{ t.capacidad }} pers.</span>
            <span class="table-loc">{{ t.ubicacion }}</span>
          </button>
        }
      </div>

      @if (selected(); as sel) {
        <div class="tracking-card" style="margin:24px 0 0">
          <h3 style="margin-bottom:8px">Confirmar reserva · {{ sel.numero }}</h3>
          <p style="color:var(--ink-muted); font-size:0.9rem; margin-bottom:16px">
            {{ fecha() }} a las {{ hora() }} · {{ comensales() }} comensales
          </p>
          @if (error()) {
            <div class="alert alert-error">{{ error() }}</div>
          }
          <button class="btn btn-primary btn-block" [disabled]="busy()" (click)="confirm()">
            {{ busy() ? 'Reservando…' : 'Reservar mesa' }}
          </button>
          <p style="font-size:0.78rem; color:var(--ink-muted); margin-top:10px">
            Tienes <strong>15 minutos</strong> para que el host confirme tu reserva. Si vence, la mesa se libera automáticamente.
          </p>
        </div>
      }
    }
  `,
})
export class ReservarPage {
  private readonly tablesSvc = inject(TablesService);
  private readonly reservations = inject(ReservationsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly hours = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];
  readonly today = todayStr;

  readonly fecha = signal(inDays(1));
  readonly hora = signal('20:30');
  readonly comensales = signal(2);
  readonly tables = signal<TableDTO[]>([]);
  readonly selectedTable = signal<TableDTO | null>(null);
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  selected() {
    return this.selectedTable();
  }

  constructor() {
    void this.search();
  }

  async search(): Promise<void> {
    this.loading.set(true);
    this.searched.set(true);
    this.error.set('');
    try {
      const tables = await this.tablesSvc.available(this.fecha(), this.hora(), this.comensales());
      this.tables.set(tables);
      this.selectedTable.set(null);
    } catch {
      this.tables.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  select(t: TableDTO): void {
    this.selectedTable.set(t);
  }

  setComensales(v: string): void {
    this.comensales.set(Number(v) || 2);
    void this.search();
  }

  async confirm(): Promise<void> {
    const sel = this.selectedTable();
    if (!sel) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await this.reservations.create({
        tableId: sel.id,
        fecha: this.fecha(),
        hora: this.hora(),
        numComensales: this.comensales(),
      });
      this.toast.show('Reserva creada — confírmala antes de que venza', 'success');
      void this.router.navigate(['/reserva', res.id]);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      if (msg?.includes('ya está reservada')) {
        this.error.set('Esa mesa acaba de ser reservada por otra persona. Prueba otra.');
        void this.search();
      } else {
        this.error.set(msg ?? 'No se pudo crear la reserva');
      }
    } finally {
      this.busy.set(false);
    }
  }
}