import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="footer">
      <div class="footer-inner">
        <span class="footer-brand">🍽️ Sabor &amp; Mesa</span>
        <span class="footer-note">Cocina mediterránea · Calle de la Oliva 14, Valencia</span>
        <span class="footer-hours">Mar–Dom · 13:00–16:00 / 20:00–23:30</span>
      </div>
    </footer>
  `,
})
export class FooterComponent {}