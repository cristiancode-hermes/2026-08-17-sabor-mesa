# 🍽️ Sabor & Mesa

Restaurante de cocina mediterránea: **carta digital, pedidos a mesa con estados en vivo, reservas con confirmación del host y tarjeta de fidelidad** (1 punto por cada 10 €).

> Daily Builder · 2026-08-17 · Angular 22 + NestJS + better-sqlite3

## Para probar (demo)

| Rol | Credenciales | Qué verás |
|---|---|---|
| Comensal | `demo@sabormesa.dev` / `demo1234` | Carta, pedido a mesa, seguimiento en vivo, reserva, perfil con puntos |
| Cocina | `cocina@sabormesa.dev` / `demo1234` | Cola de pedidos en vivo, servir platos |
| Gerente | `gerente@sabormesa.dev` / `demo1234` | Salón: KPIs, gráfico de ingresos, mesas, confirmar reservas |

## Flujo principal (comensal)

1. **Carta** → filtra por categoría/dieta y añade platos (la barra de pedido te sigue).
2. **Pedir** → escribe tu mesa (M-1…M-14) y envía a cocina. Si la mesa ya tiene pedido → 409.
3. **Seguimiento** → estados en vivo: Enviado → En cocina → Servido → Cobrado (polling + resync de pestaña).
4. **Pagar** → QR descargable, puntos de fidelidad `floor(total/10€)` añadidos al instante.
5. **Reservar** → elige slot; tienes 15 minutos para que el host confirme (expiración en servidor, sweeper cada 30 s).

## Arranque local

```bash
# API (puerto 3068)
cd apps/api && npm run start:dev   # o: node dist/main.js (previo npm run build)

# Web (dev server con proxy /api)
cd apps/web && npm start
```

Producción: `npm run build` en cada app; el SPA sirve `dist/web/browser` con `/api` en el mismo origen (Caddy).

## Estructura

```
apps/api/    NestJS: auth, menu, orders (mutex+estados+pago), tables, reservations (expiry+sweeper),
             loyalty, profile, manager, seed (datos demo con puntos derivados)
apps/web/    Angular 22 zoneless+signals: carta, pedir, mesa, pago, reservar, perfil, cocina, salon
docs/        ARCHITECTURE.md · API.md · FRONTEND.md
```

## Calidad

- **25 tests** en la API: máquinas de estado, mutex 409, pago+puntos+QR, expiración de reservas (sweeper), consistencia del seed.
- Builds de verificación: API `tsc` 0 errores · Web `ng build` 0 errores/warnings.
- E2E en navegador verificado: carta → login demo → pedido → cocina → salón → reserva → pago con QR.
- Diseño "Oliva y Naranja Culinario": terracota + oliva + tiza cálida, Fraunces/Inter/JetBrains Mono, dark mode, WCAG AA, `prefers-reduced-motion`.
