# Sabor & Mesa — Arquitectura

**Fecha:** 2026-08-17 · **Stack:** Angular 22 (zoneless, signals) + NestJS + TypeORM 1.x + better-sqlite3 · **Tema:** Restaurante (B2C)

## Visión

Aplicación de restaurante orientada al comensal: carta digital, pedidos a mesa con estados en vivo,
reservas con confirmación del host, y tarjeta de fidelidad (1 punto por cada 10 €). El personal
(cocina y gerente) tiene vistas de apoyo: cola de cocina en vivo y salón con métricas del día.

## Capa de valor de verdad: CICLO TRANSACCIONAL COMPLETO

La app no termina en el ticket: el pedido recorre una **máquina de estados** y el pago cierra el
ciclo con estado real en backend + comprobante QR + puntos de fidelidad derivados.

```
ENVIADO → EN_COCINA → SERVIDO → COBRADO     (transiciones validadas por ORDEN_TRANSITIONS)
   │                                          CANCELADO (desde ENVIADO/EN_COCINA)
```

### Reglas transaccionales implementadas

| Regla | Implementación |
|---|---|
| A. La transacción NO termina en el ticket | `pay()` marca pedido COBRADO, mesa → LIBRE, genera QR + EmailLog, suma puntos en User y LoyaltyLedger |
| B. Expiración calculada EN SERVIDOR | Reservas: `expiresAt = now + 15min` calculado en `reservations.service.ts` (nunca client-side) |
| C. Liberación automática | `SweeperService` (setInterval 30s → `expireStale()`) cancela PENDIENTE vencidas → VENCIDA + mesa LIBRE |
| D. Bloqueo de doble venta | Mutex de mesa en `create()` (transacción + `findOne` de pedido activo) → 409; reserva con `ReservationsService` checa reservas activas del slot → 409 |
| E. Comprobante fuera de la web | QR SVG determinista generado en `pay()` (comprobante `2026-0817-NNN`), descargable y "enviado por email" (EmailLog simulado) |
| F. Contadores consistentes | Puntos SIEMPRE `Math.floor(totalCents / 1000)` (1 pt / 10 €) vía `pointsForTotal` — el seed DERIVA puntos de los pedidos, nunca base arbitraria |

### Pitfalls aplicados

- `setInterval` se congela en pestaña inactiva → listeners `visibilitychange`/`focus` en MesaPage,
  CocinaPage y ReservaDetallePage re-sincronizan contra `Date.now()`/`expiresAt` real.
- TZ del negocio (Europe/Madrid) para horas del gráfico y fecha de reservas (`localDateStr`).
- Etiquetas de estado dinámicas: ENVIADO=Enviado, EN_COCINA=En cocina, SERVIDO=Servido, COBRADO=Cobrado.
- `findBy({ id: [...] })` NO funciona en TypeORM 1.x con mejor-sqlite3 → usar `In()` explícito.
- `@CreateDateColumn` pisa fechas del seed → `backdateOrderCreatedAt()` con update directo para alimentar el gráfico de revenue.

## Módulos backend (`apps/api/src`)

| Módulo | Responsabilidad | Endpoints clave |
|---|---|---|
| `auth` | JWT (usuario O email), bcrypt, roles COMENSAL/COCINA/GERENTE | POST /auth/login, /auth/register, GET /auth/me |
| `menu` | Carta: categorías + platos con filtros (vegan/gluten), alérgenos, picante | GET /menu/categories, /menu/items, /menu/items/:id |
| `orders` | Pedidos a mesa: mutex 409, máquina de estados, servir platos, pago con QR + puntos | POST /orders, GET /orders/table/:mesa, GET /orders/active, PATCH /orders/:id/status, PATCH /orders/:id/serve-dish, POST /orders/:id/pay |
| `tables` | Salón: estado de mesas, disponibilidad para reservas | GET /tables, GET /tables/available |
| `reservations` | Reservas: PENDIENTE con expiresAt (15 min), confirmar host, cancelar, sweeper | POST /reservations, GET /reservations, GET /reservations/:id, PATCH /reservations/:id/confirm, DELETE /reservations/:id |
| `loyalty` | Ledger de puntos del comensal | GET /loyalty/ledger |
| `profile` | Historial del comensal (pedidos + reservas + stats) | GET /profile |
| `manager` | Métricas del día para el gerente (rol GERENTE) | GET /manager/stats, GET /manager/revenue |
| `sweeper` | Expiración automática de reservas (cada 30 s) | — |
| `seed` | Usuarios demo, carta (18 platos), 14 mesas, pedidos con puntos derivados, reservas | — |

## Modelo de datos

- **User** (rol, puntosAcumulados) — 1:N MenuOrder, 1:N Reservation, 1:N LoyaltyLedger
- **Category** — 1:N MenuItem
- **MenuItem** (precioCents, tags JSON, alergenos JSON, picante, tiempoMedioMin, disponible)
- **Table** (numero M-1..M-14, capacidad, ubicacion terraza/interior/barra, estado)
- **MenuOrder** (numero `2026-NNNNN`, mesa, items JSON, totalCents DERIVADO, estado, notaMesa, timeline JSON)
  - **OrderItemStatus** (estadoPlato PENDIENTE/EN_PREPARACION/SERVIDO) — 1:N por plato
- **Reservation** (fechaReserva, horaInicio/horaFin, numComensales, estado, expiresAt, tableId)
- **LoyaltyLedger** (delta, concepto PEDIDO, totalRecomCents, ts) — registro inmutable de puntos
- **EmailLog** (para, asunto, qrSvg) — comprobante "enviado"

## Frontend (`apps/web/src`)

- **Zoneless + signals** (nada de zone.js en app), `provideZonelessChangeDetection()`, `withComponentInputBinding`.
- Interceptor inyecta `Authorization: Bearer <token>` desde localStorage (nunca AuthService).
- **Rutas:** / (carta), /plato/:id, /pedir, /mesa/:numero, /pago, /reservar, /reserva/:id, /perfil, /cocina, /salon, /login, /registro, 404.
- **Guards:** authGuard (autenticado), roleGuard(rol) para cocina/salón, publicOnlyGuard (login/registro).
- **Login:** split-screen 50/50 con imagen gastronómica (variedad respecto a colmado=minimalista, thrillville=card).
  Inputs vacíos + `autocomplete="off"` / `new-password`; credenciales demo visibles.
- **Polling en vivo:** cocina cada 4 s, mesa cada 5 s + resync `visibilitychange`/`focus`.
- **Gráfico revenue:** SVG con ejes X (horas 13-23) e Y (€), tooltip al hover, auto-switch a ayer si hoy no tiene datos.

## Verificación

- `npm test -w apps/api` → 25 tests (máquinas de estado, ciclo pedido con 409 mutex, pago + puntos + QR,
  reservas con sweeper/expiración/409, consistencia del seed).
- Build API: `tsc -p tsconfig.json` → 0 errores. Build Web: `ng build` → 0 errores/warnings.
- Smoke E2E en navegador (preview-server.mjs + API): carta, login demo, pedido a mesa, cocina, salón, reserva con countdown, pago con QR.
