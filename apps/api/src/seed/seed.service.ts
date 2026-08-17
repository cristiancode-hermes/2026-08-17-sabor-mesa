import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  Category,
  EmailLog,
  LoyaltyLedger,
  MenuItem,
  MenuOrder,
  OrderItemJson,
  OrderItemStatus,
  Reservation,
  Table,
  User,
  pointsForTotal,
} from '../entities/entities';

export const DEMO_PASSWORD = 'demo1234';

/** Imágenes Unsplash verificadas de gastronomía (foto real de platos). */
const IMG = {
  ensalada: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
  croquetas: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=800&q=80',
  patatas: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
  sopa: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  fideua: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80',
  arroz: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80',
  pulpo: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=800&q=80',
  secreto: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80',
  merluza: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
  curry: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&q=80',
  postre: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
  tarta: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80',
  helado: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=80',
  vino: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
  cerveza: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800&q=80',
  agua: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80',
  tostas: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80',
  trufa: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80',
};

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(Table) private readonly tables: Repository<Table>,
    @InjectRepository(MenuOrder) private readonly orders: Repository<MenuOrder>,
    @InjectRepository(OrderItemStatus) private readonly dishStatuses: Repository<OrderItemStatus>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(LoyaltyLedger) private readonly ledger: Repository<LoyaltyLedger>,
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    if ((await this.users.count()) > 0) return;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // ── Usuarios: comensal demo (protagonista), cocina y gerente (apoyo) ──
    const demo = (await this.users.save({
      nombre: 'Lucía García',
      email: 'demo@sabormesa.dev',
      username: 'demo',
      passwordHash,
      rol: 'COMENSAL',
      puntosAcumulados: 0,
    } as any)) as User;
    const cocina = (await this.users.save({
      nombre: 'Chef Andrés',
      email: 'cocina@sabormesa.dev',
      username: 'cocina',
      passwordHash,
      rol: 'COCINA',
      puntosAcumulados: 0,
    } as any)) as User;
    const gerente = (await this.users.save({
      nombre: 'Marta la Gerente',
      email: 'gerente@sabormesa.dev',
      username: 'gerente',
      passwordHash,
      rol: 'GERENTE',
      puntosAcumulados: 0,
    } as any)) as User;
    const vecino = (await this.users.save({
      nombre: 'Carlos Vega',
      email: 'carlos@sabormesa.dev',
      username: 'carlos',
      passwordHash,
      rol: 'COMENSAL',
      puntosAcumulados: 0,
    } as any)) as User;

    // ── Categorías de la carta ──
    const entrantes = (await this.categories.save({ nombre: 'Entrantes', orden: 1, icono: 'leaf' } as any)) as Category;
    const principales = (await this.categories.save({ nombre: 'Principales', orden: 2, icono: 'flame' } as any)) as Category;
    const postres = (await this.categories.save({ nombre: 'Postres', orden: 3, icono: 'cake' } as any)) as Category;
    const bebidas = (await this.categories.save({ nombre: 'Bebidas', orden: 4, icono: 'wine' } as any)) as Category;

    // ── Carta: 17 platos con dieta, alérgenos, picante y tiempo medio ──
    const defs = [
      { categoryId: entrantes.id, nombre: 'Ensalada de la huerta', descripcion: 'Tomate de temporada, pepino, cebolla roja y aceite de oliva virgen extra de la casa.', precioCents: 850, tags: ['vegano', 'sinGluten'], alergenos: [], picante: false, tiempo: 8, img: IMG.ensalada },
      { categoryId: entrantes.id, nombre: 'Croquetas caseras de jamón', descripcion: 'Bechamel cremosa con jamón ibérico, rebozadas y fritas al momento. Seis unidades.', precioCents: 950, tags: [], alergenos: ['gluten', 'lactosa', 'huevo'], picante: false, tiempo: 12, img: IMG.croquetas },
      { categoryId: entrantes.id, nombre: 'Patatas bravas bravas', descripcion: 'Cubo de patata confitada con salsa brava picante y alioli de ajo negro.', precioCents: 720, tags: ['vegano'], alergenos: ['huevo'], picante: true, tiempo: 10, img: IMG.patatas },
      { categoryId: entrantes.id, nombre: 'Tostas de tomate y anchoa', descripcion: 'Pan de cristal, tomate rallado, anchoas del Cantábrico y aceite arbequina.', precioCents: 890, tags: [], alergenos: ['gluten', 'pescado'], picante: false, tiempo: 8, img: IMG.tostas },
      { categoryId: entrantes.id, nombre: 'Crema de calabaza', descripcion: 'Calabaza asada, jengibre y semillas tostadas. Sin nata, naturalmente cremosa.', precioCents: 690, tags: ['vegano', 'sinGluten'], alergenos: ['frutosSecos'], picante: false, tiempo: 12, img: IMG.sopa },

      { categoryId: principales.id, nombre: 'Fideuá de marisco', descripcion: 'Fideos finos tostados, caldo de pescado, gambas, mejillones y alioli.', precioCents: 1690, tags: [], alergenos: ['gluten', 'marisco', 'pescado'], picante: false, tiempo: 25, img: IMG.fideua },
      { categoryId: principales.id, nombre: 'Arroz meloso de verduras', descripcion: 'Arroz bomba con verduras de temporada, azafrán y caldo vegetal. Forner de foc.', precioCents: 1450, tags: ['vegano', 'sinGluten'], alergenos: [], picante: false, tiempo: 30, img: IMG.arroz },
      { categoryId: principales.id, nombre: 'Pulpo a la brasa', descripcion: 'Pulpo gallego a la brasa con pimentón, patata aplastada y aceite de oliva.', precioCents: 1980, tags: ['sinGluten'], alergenos: ['marisco'], picante: false, tiempo: 22, img: IMG.pulpo },
      { categoryId: principales.id, nombre: 'Secreto ibérico confitado', descripcion: 'Secreto de cerdo ibérico confitado a baja temperatura, reducción de Pedro Ximénez.', precioCents: 1750, tags: ['sinGluten'], alergenos: [], picante: false, tiempo: 25, img: IMG.secreto },
      { categoryId: principales.id, nombre: 'Merluza de pincho a la plancha', descripcion: 'Merluza fresca con almejas, guisantes y un hilo de aceite de perejil.', precioCents: 1890, tags: ['sinGluten'], alergenos: ['pescado', 'marisco'], picante: false, tiempo: 20, img: IMG.merluza },
      { categoryId: principales.id, nombre: 'Curry rojo de garbanzos', descripcion: 'Garbanzos, leche de coco, curry rojo y arroz basmati. Picante suave.', precioCents: 1350, tags: ['vegano', 'sinGluten'], alergenos: ['frutosSecos'], picante: true, tiempo: 18, img: IMG.curry },
      { categoryId: principales.id, nombre: 'Risotto de boletus y trufa', descripcion: 'Arroz cremoso con boletus salteados, parmesano y láminas de trufa negra.', precioCents: 1650, tags: [], alergenos: ['lactosa', 'gluten', 'frutosSecos'], picante: false, tiempo: 22, img: IMG.trufa },

      { categoryId: postres.id, nombre: 'Tarta de queso al horno', descripcion: 'Queso crema, base de galleta y confitura de frutos rojos. Porción generosa.', precioCents: 680, tags: [], alergenos: ['gluten', 'lactosa', 'huevo'], picante: false, tiempo: 5, img: IMG.tarta },
      { categoryId: postres.id, nombre: 'Brownie con helado', descripcion: 'Brownie de chocolate 70% con helado de vainilla de Madagascar.', precioCents: 720, tags: [], alergenos: ['gluten', 'lactosa', 'huevo', 'frutosSecos'], picante: false, tiempo: 8, img: IMG.postre },
      { categoryId: postres.id, nombre: 'Sorbete de limón', descripcion: 'Sorbete refrescante de limón de cosecha propia. Vegano y sin gluten.', precioCents: 550, tags: ['vegano', 'sinGluten'], alergenos: [], picante: false, tiempo: 3, img: IMG.helado },

      { categoryId: bebidas.id, nombre: 'Vino de la casa (copa)', descripcion: 'Tinto de la tierra o blanco fresco, 15 cl. Pregunta por la sugerencia del día.', precioCents: 380, tags: ['vegano', 'sinGluten'], alergenos: [], picante: false, tiempo: 2, img: IMG.vino },
      { categoryId: bebidas.id, nombre: 'Cerveza artesana tostada', descripcion: '33 cl de cerveza local, cuerpo tostado y notas de caramelo.', precioCents: 420, tags: ['vegano'], alergenos: ['gluten'], picante: false, tiempo: 2, img: IMG.cerveza },
      { categoryId: bebidas.id, nombre: 'Agua mineral con gas', descripcion: 'Botella de 50 cl. Con o sin gas, como prefieras.', precioCents: 250, tags: ['vegano', 'sinGluten'], alergenos: [], picante: false, tiempo: 1, img: IMG.agua },
    ];

    const createdItems: MenuItem[] = [];
    for (const d of defs) {
      const item = (await this.items.save({
        categoryId: d.categoryId,
        nombre: d.nombre,
        descripcion: d.descripcion,
        precioCents: d.precioCents,
        imagenUrl: d.img,
        tags: d.tags,
        alergenos: d.alergenos,
        picante: d.picante,
        disponible: true,
        tiempoMedioMin: d.tiempo,
      } as any)) as MenuItem;
      createdItems.push(item);
    }

    // ── Mesas: 14 (terraza / interior / barra) ──
    const tableDefs = [
      { numero: 'M-1', capacidad: 2, ubicacion: 'terraza' },
      { numero: 'M-2', capacidad: 2, ubicacion: 'terraza' },
      { numero: 'M-3', capacidad: 4, ubicacion: 'terraza' },
      { numero: 'M-4', capacidad: 4, ubicacion: 'terraza' },
      { numero: 'M-5', capacidad: 6, ubicacion: 'terraza' },
      { numero: 'M-6', capacidad: 2, ubicacion: 'interior' },
      { numero: 'M-7', capacidad: 4, ubicacion: 'interior' },
      { numero: 'M-8', capacidad: 4, ubicacion: 'interior' },
      { numero: 'M-9', capacidad: 4, ubicacion: 'interior' },
      { numero: 'M-10', capacidad: 6, ubicacion: 'interior' },
      { numero: 'M-11', capacidad: 2, ubicacion: 'barra' },
      { numero: 'M-12', capacidad: 2, ubicacion: 'barra' },
      { numero: 'M-13', capacidad: 2, ubicacion: 'barra' },
      { numero: 'M-14', capacidad: 4, ubicacion: 'barra' },
    ];
    const createdTables: Table[] = [];
    for (const t of tableDefs) {
      const table = (await this.tables.save({
        numero: t.numero,
        capacidad: t.capacidad,
        estado: 'LIBRE',
        ubicacion: t.ubicacion,
      } as any)) as Table;
      createdTables.push(table);
    }

    const byName = new Map(createdItems.map((i) => [i.nombre, i]));

    // ── Pedidos históricos: cobrados AYER en horas de servicio (13-23) para el gráfico del gerente;
    //    totales DERIVADOS de items, puntos floor(total/10) (regla F). Los activos de hoy alimentan cocina. ──
    // Pedido 1: mesa M-5 (4 comensales) — cobrado ayer 14:30
    const p1 = await this.makeOrder(demo.id, 'M-5', [
      mk(byName.get('Fideuá de marisco')!, 2),
      mk(byName.get('Ensalada de la huerta')!, 1),
      mk(byName.get('Cerveza artesana tostada')!, 2),
      mk(byName.get('Tarta de queso al horno')!, 2),
    ]);
    const p1Ts = yesterdayAt(14, 30);
    p1.estado = 'COBRADO';
    p1.paidAt = p1Ts;
    await this.orders.save(p1);
    await this.backdateOrderCreatedAt(p1.id, p1Ts);
    await this.ledgerFor(demo.id, p1, p1.totalCents, p1Ts);

    // Pedido 2: mesa M-7 — cobrado ayer 13:15 (Carlos)
    const p2 = await this.makeOrder(vecino.id, 'M-7', [
      mk(byName.get('Secreto ibérico confitado')!, 1),
      mk(byName.get('Patatas bravas bravas')!, 1),
      mk(byName.get('Vino de la casa (copa)')!, 2),
    ]);
    const p2Ts = yesterdayAt(13, 15);
    p2.estado = 'COBRADO';
    p2.paidAt = p2Ts;
    await this.orders.save(p2);
    await this.backdateOrderCreatedAt(p2.id, p2Ts);
    await this.ledgerFor(vecino.id, p2, p2.totalCents, p2Ts);

    // Pedido 3: mesa M-12 — cobrado ayer 21:45 (Carlos)
    const p3 = await this.makeOrder(vecino.id, 'M-12', [
      mk(byName.get('Curry rojo de garbanzos')!, 1),
      mk(byName.get('Agua mineral con gas')!, 1),
    ]);
    const p3Ts = yesterdayAt(21, 45);
    p3.estado = 'COBRADO';
    p3.paidAt = p3Ts;
    await this.orders.save(p3);
    await this.backdateOrderCreatedAt(p3.id, p3Ts);
    await this.ledgerFor(vecino.id, p3, p3.totalCents, p3Ts);

    // Pedido 4: mesa M-3 — EN COCINA ahora mismo (cola de cocina con datos)
    const p4 = await this.makeOrder(null, 'M-3', [
      mk(byName.get('Pulpo a la brasa')!, 1),
      mk(byName.get('Risotto de boletus y trufa')!, 1),
      mk(byName.get('Vino de la casa (copa)')!, 2),
    ]);
    p4.estado = 'EN_COCINA';
    p4.sentToKitchenAt = backdateMinutes(12);
    await this.orders.save(p4);
    await this.backdateOrderCreatedAt(p4.id, backdateMinutes(14));
    await this.dishStatuses.update({ orderId: p4.id }, { estadoPlato: 'EN_PREPARACION' });
    await this.tables.update({ numero: 'M-3' }, { estado: 'OCUPADA' });

    // Pedido 5: mesa M-10 — ENVIADO hace 2 min (banner nuevo pedido)
    const p5 = await this.makeOrder(null, 'M-10', [
      mk(byName.get('Croquetas caseras de jamón')!, 1),
      mk(byName.get('Merluza de pincho a la plancha')!, 1),
      mk(byName.get('Sorbete de limón')!, 2),
    ]);
    p5.estado = 'ENVIADO';
    await this.orders.save(p5);
    await this.backdateOrderCreatedAt(p5.id, backdateMinutes(2));
    await this.tables.update({ numero: 'M-10' }, { estado: 'OCUPADA' });

    // ── Reservas: 1 PENDIENTE activa (demo), 1 VENCIDA (liberada), 1 CONFIRMADA futuro ──
    const today = localDateStr();
    const tomorrow = localDateStr(1);
    const r1 = (await this.reservations.save({
      userId: demo.id,
      tableId: createdTables[9].id, // M-10
      fechaReserva: tomorrow,
      horaInicio: '21:00',
      horaFin: '23:00',
      numComensales: 4,
      estado: 'PENDIENTE',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // viva: expira en 15 min (sweeper la vencerá si no se confirma)
    } as any)) as Reservation;
    const r2 = (await this.reservations.save({
      userId: vecino.id,
      tableId: createdTables[4].id, // M-5
      fechaReserva: today,
      horaInicio: '13:00',
      horaFin: '15:00',
      numComensales: 6,
      estado: 'VENCIDA', // ya vencida por sweeper en un día anterior — mesa libre
      expiresAt: backdateHours(5),
    } as any)) as Reservation;
    const r3 = (await this.reservations.save({
      userId: demo.id,
      tableId: createdTables[2].id, // M-3
      fechaReserva: tomorrow,
      horaInicio: '14:00',
      horaFin: '16:00',
      numComensales: 2,
      estado: 'CONFIRMADA',
      expiresAt: backdateMinutes(30),
    } as any)) as Reservation;

    void r1;
    void r2;
    void r3;
    void cocina;
    void gerente;
  }

  private async backdateOrderCreatedAt(orderId: string, ts: Date): Promise<void> {
    await this.orders
      .createQueryBuilder()
      .update(MenuOrder)
      .set({ createdAt: ts })
      .where('id = :id', { id: orderId })
      .execute();
  }

  private async makeOrder(
    userId: string | null,
    mesa: string,
    lines: { item: MenuItem; qty: number; nota?: string }[],
  ): Promise<MenuOrder> {
    const items: OrderItemJson[] = lines.map((l) => ({
      menuItemId: l.item.id,
      nombre: l.item.nombre,
      qty: l.qty,
      nota: l.nota,
      precioUnitarioCents: l.item.precioCents,
    }));
    const totalCents = items.reduce((acc, i) => acc + i.precioUnitarioCents * i.qty, 0);
    const order = (await this.orders.save({
      mesa,
      userId,
      numero: `2026-${String(Math.floor(Math.random() * 90000) + 10000)}`,
      items,
      totalCents,
      estado: 'ENVIADO',
    } as any)) as MenuOrder;
    for (const l of lines) {
      await this.dishStatuses.save({
        orderId: order.id,
        menuItemId: l.item.id,
        nombre: l.item.nombre,
        estadoPlato: 'PENDIENTE',
        tiempoMedioMin: l.item.tiempoMedioMin,
      } as any);
    }
    return order;
  }

  private async ledgerFor(userId: string, order: MenuOrder, totalCents: number, ts: Date): Promise<void> {
    const puntos = pointsForTotal(totalCents);
    await this.ledger.save({
      userId,
      delta: puntos,
      concepto: 'PEDIDO',
      orderId: order.id,
      totalRecomCents: totalCents,
      ts,
    } as any);
    const user = await this.users.findOneBy({ id: userId });
    if (user) {
      user.puntosAcumulados = (user.puntosAcumulados ?? 0) + puntos;
      await this.users.save(user);
    }
  }
}

function mk(item: MenuItem, qty: number, nota?: string) {
  return { item, qty, nota };
}

function backdateMinutes(min: number): Date {
  return new Date(Date.now() - min * 60 * 1000);
}

function backdateHours(h: number): Date {
  return backdateMinutes(h * 60);
}

/** Ayer a la hora indicada (horas de servicio del restaurante, TZ local del servidor). */
function yesterdayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function localDateStr(daysAhead = 0): string {
  const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}