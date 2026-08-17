import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="nav">
      <div class="nav-inner">
        <a routerLink="/carta" class="nav-brand">
          <span class="nav-brand-mark">🍽️</span>
          <span class="nav-brand-name">Sabor&nbsp;&amp;&nbsp;Mesa</span>
        </a>

        <nav class="nav-links">
          <a routerLink="/carta" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Carta</a>
          <a routerLink="/reservar" routerLinkActive="active">Reservar</a>
          @if (auth.isCocina() || auth.isGerente()) {
            <a routerLink="/cocina" routerLinkActive="active">Cocina</a>
          }
          @if (auth.isGerente()) {
            <a routerLink="/salon" routerLinkActive="active">Salón</a>
          }
          @if (auth.isComensal()) {
            <a routerLink="/perfil" routerLinkActive="active">Mi perfil</a>
          }
        </nav>

        <div class="nav-actions">
          @if (cart.count() > 0) {
            <a routerLink="/pedir" class="cart-chip" aria-label="Ver pedido">
              <span class="cart-icon">🧺</span>
              <span class="cart-count">{{ cart.count() }}</span>
            </a>
          }
          <button class="icon-btn" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Modo claro' : 'Modo oscuro'">
            {{ theme.dark() ? '☀️' : '🌙' }}
          </button>
          @if (auth.user(); as user) {
            <a routerLink="/perfil" class="avatar" [attr.title]="user.nombre">{{ user.nombre.charAt(0) }}</a>
            <button class="btn btn-ghost" (click)="logout()">Salir</button>
          } @else {
            <a routerLink="/login" class="btn btn-primary btn-sm">Entrar</a>
          }
        </div>
      </div>
    </header>
  `,
})
export class NavbarComponent {
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public cart = inject(CartService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/carta']);
  }
}