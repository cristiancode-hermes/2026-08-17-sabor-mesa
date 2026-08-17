# Sabor & Mesa — API

Base: `/api` · Puerto dev: 3068 · Auth: `Authorization: Bearer <jwt>` (login por **usuario o email**)
Errores: `{ "message": "..." }` · 409 = conflicto transaccional (mesa ocupada / reserva tomada / reserva vencida)

## Auth

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | /auth/register | `{ nombre, email, username, password }` | Crea comensal (rol COMENSAL) |
| POST | /auth/login | `{ identifier, password }` | identifier = username O email |
| GET | /auth/me | — | Usuario autenticado (con puntosAcumulados) |

**Credenciales demo (seed):** `demo@sabormesa.dev` / `demo1234` (comensal) · `cocina@sabormesa.dev` / `demo1234` · `gerente@sabormesa.dev` / `demo1234`

## Carta (público)

| Método | Ruta | Descripción |
|---|---|---|
| GET | /menu/categories | Categorías con icono |
| GET | /menu/items?categoryId=&vegan=&glutenFree=&search= | Platos con filtros |
| GET | /menu/items/:id | Detalle de plato (alérgenos, tags, tiempoMedioMin) |

## Pedidos (auth)

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | /orders | `{ mesa, items: [{menuItemId, qty, nota?}], notaMesa? }` | Crea pedido ENVIADO. **409** si la mesa tiene pedido activo (mutex). Precios tomados del catálogo (nunca del cliente) |
| GET | /orders/table/:mesa | — | Pedido activo de la mesa o null |
| GET | /orders/active | — | Cola de cocina (ENVIADO + EN_COCINA, con dishStatuses) |
| GET | /orders/:id | — | Detalle del pedido |
| GET | /orders/mine | — | Historial del comensal |
| PATCH | /orders/:id/status | `{ estado }` | ENVIADO→EN_COCINA→SERVIDO (o CANCELADO desde ENVIADO/EN_COCINA). 400 si la transición no es válida |
| PATCH | /orders/:id/serve-dish | `{ menuItemId }` | Marca plato SERVIDO; si todos servidos → pedido SERVIDO |
| POST | /orders/:id/pay | — | COBRADO + mesa LIBRE + puntos `floor(total/10€)` + QR + EmailLog. **409** si ya cobrado/cancelado |

Respuesta `pay`:
```json
{
  "order": { "...": "pedido COBRADO con comprobanteNumero" },
  "puntosGanados": 4,
  "comprobante": { "qrSvg": "<svg…>", "numero": "2026-0817-001" }
}
```

## Mesas y reservas (auth)

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| GET | /tables | — | Todas las mesas con estado (salón) |
| GET | /tables/available?fecha=&hora=&comensales= | — | Mesas libres para el slot |
| POST | /reservations | `{ tableId, fecha, hora, numComensales }` | Crea PENDIENTE con **expiresAt = now+15min (servidor)**. 409 si el slot ya está tomado |
| GET | /reservations | — | Reservas del usuario (gerente: todas) |
| GET | /reservations/:id | — | Detalle con mesa |
| PATCH | /reservations/:id/confirm | — | Host confirma → CONFIRMADA + mesa RESERVADA. **409** si vencida |
| DELETE | /reservations/:id | — | Cancela → CANCELADA + mesa liberada |

**Sweeper** (cada 30 s): PENDIENTE con `expiresAt < now` → VENCIDA + mesa LIBRE. Libera el recurso sin esperar requests.

## Fidelidad y perfil (auth)

| Método | Ruta | Descripción |
|---|---|---|
| GET | /loyalty/ledger | Movimientos de puntos (concepto, delta, totalRecomCents) |
| GET | /profile | `{ user, stats: {totalPedidos, totalGastadoCents, puntos}, pedidos: [...], reservas: [...] }` |

## Gerente (rol GERENTE)

| Método | Ruta | Descripción |
|---|---|---|
| GET | /manager/stats?fecha=YYYY-MM-DD | Ingresos, pedidos, platos servidos, ticket medio (TZ Europe/Madrid) |
| GET | /manager/revenue?fecha=YYYY-MM-DD | Ingresos por hora (13:00-23:00) para el gráfico |

## Estados

```
Pedido:   ENVIADO → EN_COCINA → SERVIDO → COBRADO · CANCELADO
Plato:    PENDIENTE → EN_PREPARACION → SERVIDO
Mesa:     LIBRE · OCUPADA · RESERVADA · SUCIO
Reserva:  PENDIENTE → CONFIRMADA → COMPLETADA · CANCELADA · VENCIDA
```
