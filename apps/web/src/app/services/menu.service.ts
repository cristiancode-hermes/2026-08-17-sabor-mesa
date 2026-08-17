import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Category, MenuItem } from '../models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly categories = signal<Category[]>([]);
  readonly items = signal<MenuItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  async load(opts?: { categoryId?: string; vegan?: boolean; glutenFree?: boolean }): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [categories, items] = await Promise.all([
        this.api.get<Category[]>('/menu/categories'),
        this.api.get<MenuItem[]>('/menu/items', {
          category: opts?.categoryId,
          vegan: opts?.vegan ? 'true' : undefined,
          glutenFree: opts?.glutenFree ? 'true' : undefined,
        }),
      ]);
      this.categories.set(categories);
      this.items.set(items);
    } catch {
      this.error.set('No se pudo cargar la carta');
    } finally {
      this.loading.set(false);
    }
  }

  async detail(id: string): Promise<MenuItem> {
    return this.api.get<MenuItem>(`/menu/items/${id}`);
  }
}