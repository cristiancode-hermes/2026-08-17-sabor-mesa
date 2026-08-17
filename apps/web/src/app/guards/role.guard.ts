import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ready;
    const user = auth.user();
    if (user && roles.includes(user.rol)) return true;
    if (!user) return router.createUrlTree(['/login'], { queryParams: { next: router.url } });
    return router.createUrlTree(['/carta']);
  };
}