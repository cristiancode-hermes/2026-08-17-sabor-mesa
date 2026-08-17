import { Routes } from '@angular/router';
import { authGuard } from './app/guards/auth.guard';
import { roleGuard } from './app/guards/role.guard';
import { publicOnlyGuard } from './app/guards/public-only.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'carta' },
  {
    path: 'carta',
    loadComponent: () => import('./app/pages/carta').then((m) => m.CartaPage),
  },
  {
    path: 'plato/:id',
    loadComponent: () => import('./app/pages/plato-detalle').then((m) => m.PlatoDetallePage),
  },
  {
    path: 'pedir',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/pedir').then((m) => m.PedirPage),
  },
  {
    path: 'mesa/:numero',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/mesa').then((m) => m.MesaPage),
  },
  {
    path: 'pago',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/pago').then((m) => m.PagoPage),
  },
  {
    path: 'reservar',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/reservar').then((m) => m.ReservarPage),
  },
  {
    path: 'reserva/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/reserva-detalle').then((m) => m.ReservaDetallePage),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./app/pages/perfil').then((m) => m.PerfilPage),
  },
  {
    path: 'cocina',
    canActivate: [roleGuard('COCINA', 'GERENTE')],
    loadComponent: () => import('./app/pages/cocina').then((m) => m.CocinaPage),
  },
  {
    path: 'salon',
    canActivate: [roleGuard('GERENTE')],
    loadComponent: () => import('./app/pages/salon').then((m) => m.SalonPage),
  },
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./app/pages/login').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./app/pages/registro').then((m) => m.RegistroPage),
  },
  {
    path: '**',
    loadComponent: () => import('./app/pages/not-found').then((m) => m.NotFoundPage),
  },
];