import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { LoyaltyEntry, ManagerStats, ProfileDTO, RevenuePoint } from '../models';

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  constructor(private readonly api: ApiService) {}

  ledger(): Promise<LoyaltyEntry[]> {
    return this.api.get<LoyaltyEntry[]>('/loyalty/ledger');
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly api: ApiService) {}

  profile(): Promise<ProfileDTO> {
    return this.api.get<ProfileDTO>('/profile');
  }
}

@Injectable({ providedIn: 'root' })
export class ManagerService {
  constructor(private readonly api: ApiService) {}

  stats(fecha?: string): Promise<ManagerStats> {
    return this.api.get<ManagerStats>('/manager/stats', { fecha });
  }

  revenue(fecha?: string): Promise<RevenuePoint[]> {
    return this.api.get<RevenuePoint[]>('/manager/revenue', { fecha });
  }
}