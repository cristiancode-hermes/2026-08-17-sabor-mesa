import { Injectable, signal, effect } from '@angular/core';

const THEME_KEY = 'sabor_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(false);

  constructor() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      this.dark.set(stored === 'dark');
    } else {
      this.dark.set(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    }
    effect(() => {
      const isDark = this.dark();
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.dark.set(!this.dark());
  }
}