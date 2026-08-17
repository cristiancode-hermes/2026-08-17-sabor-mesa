import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { MenuOrder } from '../models';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  readonly active = signal<MenuOrder | null>(null);
  readonly loading = signal(false);

  constructor(private readonly api: ApiService) {}

  async create(dto: { mesa: string; items: { menuItemId: string; qty: number; nota?: string }[]; notaMesa?: string }): Promise<MenuOrder> {
    const order = await this.api.post<MenuOrder>('/orders', dto);
    this.active.set(order);
    return order;
  }

  async refreshTable(mesa: string): Promise<MenuOrder | null> {
    const order = await this.api.get<MenuOrder | null>(`/orders/table/${mesa}`);
    this.active.set(order);
    return order;
  }

  async detail(id: string): Promise<MenuOrder> {
    return this.api.get<MenuOrder>(`/orders/${id}`);
  }

  async activeKitchen(): Promise<MenuOrder[]> {
    return this.api.get<MenuOrder[]>('/orders/active');
  }

  async transition(id: string, estado: string): Promise<MenuOrder> {
    return this.api.patch<MenuOrder>(`/orders/${id}/status`, { estado });
  }

  async serveDish(id: string, menuItemId: string): Promise<MenuOrder> {
    return this.api.patch<MenuOrder>(`/orders/${id}/serve-dish`, { menuItemId });
  }

  async pay(id: string): Promise<{ order: MenuOrder; comprobante: { qrSvg: string; numero: string }; puntosGanados: number }> {
    return this.api.post<{ order: MenuOrder; comprobante: { qrSvg: string; numero: string }; puntosGanados: number }>(
      `/orders/${id}/pay`,
    );
  }

  async mine(): Promise<MenuOrder[]> {
    return this.api.get<MenuOrder[]>('/orders/mine');
  }
}