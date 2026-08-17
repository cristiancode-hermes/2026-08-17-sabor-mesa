import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { AuthUser } from '../models';

export const DEMO_CREDENTIALS = { identifier: 'demo@sabormesa.dev', password: 'demo1234' };
export const DEMO_COCINA = { identifier: 'cocina@sabormesa.dev', password: 'demo1234' };
export const DEMO_GERENTE = { identifier: 'gerente@sabormesa.dev', password: 'demo1234' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  readonly token = signal<string | null>(localStorage.getItem('sabor_token'));
  readonly isComensal = computed(() => this.user()?.rol === 'COMENSAL');
  readonly isCocina = computed(() => this.user()?.rol === 'COCINA');
  readonly isGerente = computed(() => this.user()?.rol === 'GERENTE');

  private resolveReady!: () => void;
  /** Resuelve cuando termina el primer intento de restaurar la sesión. */
  readonly ready: Promise<void> = new Promise((r) => (this.resolveReady = r));

  constructor(private readonly api: ApiService) {
    const cached = localStorage.getItem('sabor_user');
    if (cached) {
      try {
        this.user.set(JSON.parse(cached));
      } catch {
        localStorage.removeItem('sabor_user');
      }
    }
    if (this.token() && !this.user()) {
      void this.refresh().finally(() => this.resolveReady());
    } else {
      this.resolveReady();
    }
  }

  async login(identifier: string, password: string): Promise<AuthUser> {
    const res = await this.api.post<{ token: string; user: AuthUser }>('/auth/login', {
      identifier,
      password,
    });
    this.persist(res);
    return res.user;
  }

  async register(dto: { nombre: string; email: string; username: string; password: string }): Promise<AuthUser> {
    const res = await this.api.post<{ token: string; user: AuthUser }>('/auth/register', dto);
    this.persist(res);
    return res.user;
  }

  async refresh(): Promise<void> {
    if (!this.token()) return;
    try {
      const user = await this.api.get<AuthUser>('/auth/me');
      this.user.set(user);
      localStorage.setItem('sabor_user', JSON.stringify(user));
    } catch {
      this.logout();
    }
  }

  logout(): void {
    this.user.set(null);
    this.token.set(null);
    localStorage.removeItem('sabor_token');
    localStorage.removeItem('sabor_user');
  }

  private persist(res: { token: string; user: AuthUser }): void {
    this.token.set(res.token);
    this.user.set(res.user);
    localStorage.setItem('sabor_token', res.token);
    localStorage.setItem('sabor_user', JSON.stringify(res.user));
  }
}