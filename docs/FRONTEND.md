# Sabor & Mesa — Frontend

## Stack

- **Angular 22** standalone, **zoneless** (`provideZonelessChangeDetection`) + signals en toda la app.
- Tailwind v4 solo como preprocesador; el diseño real vive en `src/styles.source.css`
  (compilado por `scripts/build-css.cjs` → `styles.css`). **No tocar `styles.css` a mano.**
- Interceptor `auth.interceptor.ts` lee el token de `localStorage` — nunca inyectar AuthService en un interceptor.

## Estructura

```
src/
├── app.config.ts            # providers (router, http, zoneless)
├── app.routes.ts            # rutas con guards lazy
├── app/app.component.ts     # shell: navbar + toaster + router-outlet + footer
├── app/layout/              # navbar.ts, footer.ts
├── app/services/            # api, auth, menu, cart, orders, tables, loyalty, toast, theme
├── app/guards/              # auth.guard, role.guard, public-only.guard
├── app/interceptors/        # auth.interceptor
├── app/components/shared.ts # dish-card, diet-chip, empty, skeleton, stepper, table-tile
└── app/pages/               # carta, plato-detalle, pedir, mesa, pago, reservar,
                             # reserva-detalle, perfil, cocina, salon, login, registro, not-found
```

## Diseño: "Oliva y Naranja Culinario"

Tokens CSS en `:root` + `html[data-theme='dark']`:

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--bg` | #FBF7F0 (tiza cálida) | #171310 | Fondo |
| `--surface` | #FFFFFF | #221C17 | Cards |
| `--ink` | #241F1A | #F3EDE6 | Texto principal |
| `--ink-muted` | #6B6157 | #A9A097 | Texto secundario (≥4.5:1) |
| `--primary` | #C95F2B (terracota) | #E0783F | Acción principal, CTA |
| `--secondary` | #5A7340 (oliva) | #7D9A5C | Acción secundaria, enlaces |
| `--success/-warning/-danger` | #3E7C4F / #B97F14 / #B3362E | claros | Estados |

Tipografía: **Fraunces** (display, h1-h3, `text-wrap: balance`) + **Inter** (body, line-height 1.6) +
**JetBrains Mono** (precios, números de mesa, countdown). Hero `clamp(2rem, 5vw, 3.5rem)` ≤ 6rem.
Motion: ease-out, shimmer para skeletons, `prefers-reduced-motion: reduce` global.

## Patrones clave

### Carrito (signals + localStorage)
`CartService` mantiene líneas `{menuItemId, nombre, precioUnitarioCents, qty, nota}` en `sabor_cart`.
El total se recalcula como computed; los precios SIEMPRE vienen del catálogo (el backend los re-valida).

### Pedido a mesa
`PedirPage` → `OrdersService.create()` → redirige a `/mesa/:numero`.
`MesaPage` hace polling cada 5 s + resync en `visibilitychange`/`focus` (setInterval se congela en pestaña inactiva).
El stepper muestra ENVIADO → EN_COCINA → SERVIDO → COBRADO.

### Cocina en vivo
`CocinaPage` polling cada 4 s; toast "Nuevo pedido de la mesa X" para pedidos ENVIADO recién vistos;
botones "Comenzar preparación" (→EN_COCINA) y "Servir" por plato (→SERVIDO cuando todos servidos).

### Reservas con expiración
`ReservarPage` busca mesas disponibles para fecha/hora/comensales; al crear, `expiresAt` viene del servidor.
`ReservaDetallePage` muestra countdown **calculado contra Date.now() real** y refresca al volver a la pestaña.
Si el sweeper la venció, la UI muestra "VENCIDA" y la mesa se libera.

### Pago y comprobante
`PagoPage.pay()` → comprobante con QR (SVG inyectado con `DomSanitizer.bypassSecurityTrustHtml` — **innerHTML
puro NO renderiza SVG**), badge de puntos ganados, botón descargar SVG y "enviar email" (simulado).

### Salón del gerente
`SalonPage`: KPIs del día, gráfico SVG de ingresos por hora (ejes X horas 13-23, Y €, tooltip al hover;
si hoy no tiene datos muestra ayer automáticamente), grid de mesas con estado de color, reservas del día
con confirmación del host.

### Login
Split-screen 50/50 (imagen gastronómica + overlay de marca | formulario sin caja). Inputs VACÍOS
(`signal('')`, `autocomplete="off"` / `new-password`), credenciales demo en bloque discreto debajo del form.
Al entrar: COCINA → /cocina, GERENTE → /salon, comensal → /carta (o `?next=`).

## Servicios HTTP

`ApiService` envuelve HttpClient con base `/api` y devuelve `firstValueFrom` (promesas). Errores:
`throw { error: { message } }` para que las páginas muestren mensajes legibles.

## Responsive

- Navbar: links colapsan a fila scrollable bajo 768px.
- Grid de platos: `repeat(auto-fill, minmax(260px, 1fr))` → 150px en móvil.
- Split login → 1 columna (imagen 200px arriba) en móvil.
- Stats del salón: 2 columnas en móvil.
- Botones ≥44px min-height; touch targets ≥44px.
