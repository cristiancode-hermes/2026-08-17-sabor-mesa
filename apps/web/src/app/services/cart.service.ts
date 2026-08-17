import { Injectable, signal, computed } from '@angular/core';
import { CartLine } from '../models';

const STORAGE_KEY = 'sabor_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly lines = signal<CartLine[]>(this.load());
  readonly count = computed(() => this.lines().reduce((acc, l) => acc + l.qty, 0));
  readonly totalCents = computed(() => this.lines().reduce((acc, l) => acc + l.precioUnitarioCents * l.qty, 0));

  add(item: { id: string; nombre: string; precioCents: number; imagenUrl?: string | null }, qty = 1): void {
    const lines = [...this.lines()];
    const existing = lines.find((l) => l.menuItemId === item.id);
    if (existing) {
      existing.qty += qty;
    } else {
      lines.push({
        menuItemId: item.id,
        nombre: item.nombre,
        precioUnitarioCents: item.precioCents,
        qty,
        imagenUrl: item.imagenUrl,
      });
    }
    this.lines.set(lines);
    this.save();
  }

  setQty(menuItemId: string, qty: number): void {
    const lines = this.lines().map((l) => (l.menuItemId === menuItemId ? { ...l, qty: Math.max(0, qty) } : l));
    this.lines.set(lines.filter((l) => l.qty > 0));
    this.save();
  }

  setNota(menuItemId: string, nota: string): void {
    const lines = this.lines().map((l) => (l.menuItemId === menuItemId ? { ...l, nota: nota || undefined } : l));
    this.lines.set(lines);
    this.save();
  }

  clear(): void {
    this.lines.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private load(): CartLine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines()));
  }
}