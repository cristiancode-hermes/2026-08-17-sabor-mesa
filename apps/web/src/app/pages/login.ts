import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, DEMO_CREDENTIALS, DEMO_COCINA, DEMO_GERENTE } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-split">
      <div class="auth-visual">
        <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80" alt="Comedor de Sabor & Mesa" />
        <div class="auth-visual-overlay">
          <span class="auth-brand">Sabor &amp; Mesa</span>
          <p>La cocina mediterránea de la casa, pedida desde tu mesa y servida al momento.</p>
        </div>
      </div>
      <div class="auth-form-side">
        <div class="auth-form-wrap">
          <h1 class="auth-form-title">Bienvenido de vuelta</h1>
          <p class="auth-form-sub">Entra para pedir a tu mesa o reservar.</p>

          <form class="auth-form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="id">Email o usuario</label>
              <input id="id" class="input" name="identifier" [(ngModel)]="identifier" autocomplete="off" placeholder="demo@sabormesa.dev" />
            </div>
            <div class="field">
              <label for="pass">Contraseña</label>
              <input id="pass" class="input" type="password" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="••••••••" />
            </div>
            @if (error()) {
              <div class="alert alert-error">{{ error() }}</div>
            }
            <button class="btn btn-primary btn-block" [disabled]="busy()">
              {{ busy() ? 'Entrando…' : 'Entrar' }}
            </button>
          </form>

          <div class="auth-demo">
            <strong>Cuentas de prueba</strong><br />
            Comensal: <code>{{ demo.identifier }}</code> / <code>{{ demo.password }}</code><br />
            Cocina: <code>{{ cocina.identifier }}</code> / <code>{{ cocina.password }}</code><br />
            Gerente: <code>{{ gerente.identifier }}</code> / <code>{{ gerente.password }}</code>
          </div>

          <p class="auth-link">¿No tienes cuenta? <a routerLink="/registro">Regístrate en un minuto</a></p>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly demo = DEMO_CREDENTIALS;
  readonly cocina = DEMO_COCINA;
  readonly gerente = DEMO_GERENTE;
  readonly identifier = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      const user = await this.auth.login(this.identifier(), this.password());
      const next = new URLSearchParams(window.location.search).get('next');
      const home =
        user.rol === 'COCINA' ? '/cocina' : user.rol === 'GERENTE' ? '/salon' : next || '/carta';
      void this.router.navigateByUrl(home);
    } catch {
      this.error.set('Credenciales inválidas. Prueba con las cuentas de demo.');
    } finally {
      this.busy.set(false);
    }
  }
}