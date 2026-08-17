import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './layout/navbar';
import { FooterComponent } from './layout/footer';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    <main class="page">
      <router-outlet />
    </main>
    <app-footer />

    <div class="toaster" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.tone }}" (click)="toast.dismiss(t.id)">
          {{ t.message }}
        </div>
      }
    </div>
  `,
})
export class AppComponent {
  public toast = inject(ToastService);
}