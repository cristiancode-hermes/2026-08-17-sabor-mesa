import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="notfound">
      <div class="notfound-code">404</div>
      <h2>Esta página no está en la carta</h2>
      <p style="color:var(--ink-muted); margin:12px 0 24px">La dirección no existe o ha cambiado de sitio.</p>
      <a routerLink="/carta" class="btn btn-primary">Volver a la carta</a>
    </div>
  `,
})
export class NotFoundPage {}