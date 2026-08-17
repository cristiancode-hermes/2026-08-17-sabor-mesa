import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Reservation, TableDTO } from '../models';

@Injectable({ providedIn: 'root' })
export class TablesService {
  constructor(private readonly api: ApiService) {}

  available(fecha: string, hora: string, comensales: number): Promise<TableDTO[]> {
    return this.api.get<TableDTO[]>('/tables/available', { fecha, hora, comensales });
  }

  all(): Promise<TableDTO[]> {
    return this.api.get<TableDTO[]>('/tables');
  }
}

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  constructor(private readonly api: ApiService) {}

  create(dto: { tableId: string; fecha: string; hora: string; numComensales: number }): Promise<Reservation> {
    return this.api.post<Reservation>('/reservations', dto);
  }

  detail(id: string): Promise<Reservation> {
    return this.api.get<Reservation>(`/reservations/${id}`);
  }

  mine(): Promise<Reservation[]> {
    return this.api.get<Reservation[]>('/reservations');
  }

  confirm(id: string): Promise<Reservation> {
    return this.api.patch<Reservation>(`/reservations/${id}/confirm`);
  }

  cancel(id: string): Promise<{ cancelled: boolean }> {
    return this.api.delete<{ cancelled: boolean }>(`/reservations/${id}`);
  }
}