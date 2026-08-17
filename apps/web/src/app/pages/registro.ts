import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, DEMO_CREDENTIALS } from '../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-split">
      <div class="auth-visual">
        <img src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=1200&q=80" alt="Mesa puesta de Sabor & Mesa" />
        <div class="auth-visual-overlay">
          <span class="auth-brand">Sabor &amp; Mesa</span>
          <p>Crea tu tarjeta de fidelidad y acumula 1 punto por cada 10 € que disfrutes en la casa.</p>
        </div>
      </div>
      <div class="auth-form-side">
        <div class="auth-form-wrap">
          <h1 class="auth-form-title">Crear cuenta</h1>
          <p class="auth-form-sub">Empieza a ganar puntos de fidelidad.</p>

          <form class="auth-form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="nombre">Nombre</label>
              <input id="nombre" class="input" name="nombre" [(ngModel)]="nombre" autocomplete="off" placeholder="Tu nombre" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" class="input" type="email" name="email" [(ngModel)]="email" autocomplete="off" placeholder="tu@email.com" />
            </div>
            <div class="field">
              <label for="username">Usuario</label>
              <input id="username" class="input" name="username" [(ngModel)]="username" autocomplete="off" placeholder="tuusuario" />
            </div>
            <div class="field">
              <label for="pass">Contraseña</label>
              <input id="pass" class="input" type="password" name="password" [(ngModel)]="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
            </div>
            @if (error()) {
              <div class="alert alert-error">{{ error() }}</div>
            }
            <button class="btn btn-primary btn-block" [disabled]="busy()">
              {{ busy() ? 'Creando cuenta…' : 'Crear mi cuenta' }}
            </button>
          </form>

          <div class="auth-demo">
            <strong>Cuenta demo:</strong> <code>{{ demo.identifier }}</code> / <code>{{ demo.password }}</code>
          </div>

          <p class="auth-link">¿Ya tienes cuenta? <a routerLink="/login">Entra aquí</a></p>
        </div>
      </div>
    </div>
  `,
})
export class RegistroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly demo = DEMO_CREDENTIALS;
  readonly nombre = signal('');
  readonly email = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.register({
        nombre: this.nombre(),
        email: this.email(),
        username: this.username(),
        password: this.password(),
      });
      void this.router.navigateByUrl('/carta');
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'No se pudo crear la cuenta');
    } finally {
      this.busy.set(false);
    }
  }
}