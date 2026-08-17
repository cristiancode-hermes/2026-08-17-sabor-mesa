# QA Report — 2026-08-17 Sabor & Mesa

**Project:** Restaurante mediterráneo B2C — carta digital, pedidos a mesa con estados en vivo, reservas con expiración en servidor y fidelidad por puntos
**Stack:** Angular 22 (standalone, signals, zoneless) + NestJS 11 + TypeORM 1.x + better-sqlite3
**Author:** Hermes Daily Builder + QA

## ✅ 1. Build Verification

| Target | Status | Details |
|---|---|---|
| API `tsc` | ✅ PASS | `npx tsc -p tsconfig.json --incremental false` → 0 errores, dist/main.js OK |
| Web `ng build` | ✅ PASS | 0 errores/warnings; salida `dist/web/browser/` con `<base href="/">` (rutas profundas OK) |
| TypeScript | ✅ 6.0.3 | Requisito Angular 22 satisfecho |

## ✅ 2. Test Results

**25 test cases · 0 assertions counted (jest) — 3 suites, ALL PASSED**

| Test Suite | Test Case | Assertions |
|---|---|---|
| order-machine.spec.ts | Máquina de estados del pedido (transiciones válidas/inválidas) | PASS |
| orders-cycle.spec.ts | Ciclo transaccional: mutex 409, pago, puntos, QR, mesa liberada | PASS |
| reservations-expiry.spec.ts | Expiración de reservas (expiresAt, sweeper, 409 slot ocupado) | PASS |

## ✅ 3. Endpoint Verification (72/72 PASS)

| Área | Checks | Resultado |
|---|---|---|
| Auth | login x3 roles (email y username), register, /me, 401 pass incorrecta | ✅ |
| Carta | categorías, 18 items, detalle == lista (precio/nombre), búsqueda | ✅ |
| Pedidos | crear 201 ENVIADO, total == 2x precio catálogo, **mutex 409** 2º pedido, cola cocina, transición inválida 400, EN_COCINA→SERVIDO, **pay → COBRADO + QR + comprobante + puntos floor(total/10€)**, pay repetido 409, mesa LIBRE, historial tras pagar | ✅ |
| Fidelidad | puntos == seed+ganados (6+2), ledger, perfil consistente | ✅ |
| Reservas | available, crear PENDIENTE con **expiresAt servidor ~15 min**, **mutex 409** misma mesa+slot, confirm CONFIRMADA + mesa RESERVADA, complete COMPLETADA | ✅ |
| Sweeper (vivo) | PENDIENTE expirada → **VENCIDA + mesa LIBRE automáticamente** (35s); CONFIRMADA con slot pasado → COMPLETADA | ✅ |
| Gerente | stats 200 (gerente), revenue serie horaria 13:00-23:00, **403 comensal** en rutas gerente/cocina | ✅ |
| Gráficos | Ingresos por hora: ejes (0/1700/3400/5100), horas 13h-23h, **Σ barras == KPI ingresos (11.260 cént.)**, TZ Europe/Madrid | ✅ |

## ✅ 4. Browser QA (subdominio desplegado)

| Página/Ruta | Resultado |
|---|---|
| `/carta` (pública) | ✅ Menú con filtros, fotos, precios; diseño "Oliva y Naranja" pulido, contraste AA |
| `/login` (demo credenciales bajo el formulario) | ✅ Login con email o usuario; logout limpia token (localStorage null) |
| `/plato/:id` (ruta dinámica 2 segmentos) | ✅ Detalle con imagen, precio, dietas, tiempo, añadir |
| `/pedir` | ✅ Carrito persistente, stepper cantidades, nota por plato, mesa, envío a cocina |
| `/mesa/:numero` (ruta dinámica) | ✅ Seguimiento en vivo: badge estado, timeline 4 etapas, platos con estado, "Pedir la cuenta" aparece solo en SERVIDO |
| `/cocina` (rol COCINA) | ✅ Cola en vivo, timers por mesa, Comenzar preparación, Servir plato a plato |
| `/salon` (rol GERENTE) | ✅ KPIs, mesas en tiempo real, gráfico de ingresos por hora con ejes/fechas, reservas del día |
| `/reservar` | ✅ Slot selector, mesas disponibles en tiempo real, confirmación de reserva |
| `/reserva/:id` (ruta dinámica) | ✅ Badge PENDIENTE, detalles, **countdown 15 min**, cancelar |
| `/pago` | ✅ Pagar 29,50 € → QR visible, comprobante, +2 pts, Descargar QR, Enviarme el comprobante |
| `/perfil` | ✅ Puntos (6 = floor 64,30€/10), pedidos, reservas (PENDIENTE/VENCIDA/CONFIRMADA), ledger |
| Consola | ✅ 0 errores JS en todas las páginas |
| Responsive 390px | ✅ Sin overflow horizontal, header ok, chips envuelven, grid 2 col |

## ✅ 5. Incidencias corregidas durante QA

| Incidencia | Severidad | Fix |
|---|---|---|
| QR SVG (250px) desbordaba su caja (180px) y el texto del comprobante se solapaba con el QR | Menor (visual) | CSS `.receipt-qr svg { width/height:100% }` + `flex-shrink:0` → QR 154px dentro de la caja, sin solape (verificado en DOM y screenshot) |
| Captura de portafolio salía con navbar deslogueada (`Entrar`) | Menor (solo captura) | Añadida clave `sabor_token`/`sabor_user` al bloque principal de inyección de `prod-capture.mjs` (solo estaba en el bloque fallback) → recaptura con sesión restaurada |

## ✅ 6. Security Scan

| Check | Resultado |
|---|---|
| Interceptor `***` malformado | ✅ NO presente (bytes verificados: `Bearer ${token}` correcto) |
| Claves hardcodeadas | ✅ Solo JWT_SECRET dev local |
| SQL inyectable | ✅ QueryBuilder parametrizado / In() / IsNull() |
| TypeORM 1.x patrones rotos (timestamp, null as any, delete({})) | ✅ Ninguno presente |
| Rutas públicas | ✅ register/login públicos; resto con guards por rol |

## ✅ 7. Deployment

| Target | Resultado | Detalles |
|---|---|---|
| GitHub | ✅ DONE | https://github.com/cristiancode-hermes/2026-08-17-sabor-mesa (commit 89ffa3c) |
| Caddy subdominio | ✅ DONE | https://sabor-mesa.proyectos.cristiancode.dev → 200; API /api → 201 login |
| manage-apis/watchdog | ✅ DONE | Port 3067 en PORTS/NAMES/DIRS (52 aligned) + watchdog-apis.sh línea 35 "3067\|sabor-mesa\|2026-08-17-sabor-mesa" |
| Excel | ✅ DONE | Row 82 en proyectos_completo.xlsx |
| Landing page | ✅ DONE | proyectos.cristiancode.dev → sabor-mesa presente (grep live = 1) |
| Portafolio (es/en/pt) | ✅ DONE | Entrada id 193 + tema `theme_sabor_mesa` (Oliva y Naranja) |
| Screenshots captura | ✅ DONE | assets/sabor-mesa.png (486 KB, navbar logueada + carta) y -m.png (101 KB) |
| Sweeper en producción | ✅ DONE | Activo (log cada 30 s) — expira reservas y libera mesas sin requests |

## Summary

**OVERALL: PASS ✅**

- 25/25 tests unitarios + 72/72 checks de endpoints + E2E de navegador completo (carta → login → pedido → cocina → salón → reserva → pago QR)
- Ciclo transaccional completo verificado: mutex 409, expiración EN SERVIDOR, sweeper 30 s, comprobante QR + email, puntos derivados del importe real
- 2 incidencias menores corregidas y re-verificadas
- Desplegado y publicado en los 6 destinos (GitHub, Caddy, manage-apis, Excel, landing, portafolio + capturas)