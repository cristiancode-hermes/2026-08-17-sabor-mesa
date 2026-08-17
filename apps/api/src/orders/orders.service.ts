import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  EmailLog,
  LoyaltyLedger,
  MenuItem,
  MenuOrder,
  OrderItemJson,
  OrderItemStatus,
  OrderStatus,
  OrderTimelineEvent,
  Table,
  User,
  pointsForTotal,
} from '../entities/entities';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '../entities/entities';

/** Genera un QR SVG simple (patrón determinista) para el comprobante de pago. */
export function generateQrSvg(seed: string): string {
  const size = 21;
  const cells: boolean[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let state = h || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
  for (let i = 0; i < size * size; i++) cells.push(rand() > 0.5);
  const finder = (cx: number, cy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[(cy + y) * size + (cx + x)] = border || core;
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  const scale = 10;
  const padding = 20;
  const dim = size * scale + padding * 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">`;
  svg += `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (cells[y * size + x]) {
        svg += `<rect x="${padding + x * scale}" y="${padding + y * scale}" width="${scale}" height="${scale}" fill="#241F1A"/>`;
      }
    }
  }
  svg += `</svg>`;
  return svg;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MenuOrder) private readonly orders: Repository<MenuOrder>,
    @InjectRepository(OrderItemStatus) private readonly dishStatuses: Repository<OrderItemStatus>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(Table) private readonly tables: Repository<Table>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoyaltyLedger) private readonly ledger: Repository<LoyaltyLedger>,
    @InjectRepository(EmailLog) private readonly emailLogs: Repository<EmailLog>,
  ) {}

  /** Serializa con dishStatuses cargados + timeline. */
  private async serialize(id: string): Promise<MenuOrder> {
    const order = await this.orders.findOne({ where: { id }, relations: { dishStatuses: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  private buildTimeline(order: MenuOrder): OrderTimelineEvent[] {
    const events: OrderTimelineEvent[] = [];
    events.push({ estado: 'ENVIADO', label: 'Pedido enviado a cocina', at: order.createdAt.toISOString() });
    if (order.sentToKitchenAt) {
      events.push({ estado: 'EN_COCINA', label: 'La cocina lo está preparando', at: order.sentToKitchenAt.toISOString() });
    }
    if (order.servedAt) {
      events.push({ estado: 'SERVIDO', label: 'Servido en tu mesa', at: order.servedAt.toISOString() });
    }
    if (order.paidAt) {
      events.push({ estado: 'COBRADO', label: 'Cuenta cobrada', at: order.paidAt.toISOString() });
    }
    if (order.cancelledAt) {
      events.push({ estado: 'CANCELADO', label: 'Pedido cancelado', at: order.cancelledAt.toISOString() });
    }
    return events;
  }

  /**
   * Crear pedido a mesa — ciclo transaccional (reglas A/D).
   * Transacción única: mutex por mesa (chequeo de pedido activo dentro de la tx),
   * mesa → OCUPADA, snapshot de items con precio del menú, total calculado en backend,
   * estados por plato PENDIENTE.
   * Si la mesa ya tiene pedido activo (ENVIADO/EN_COCINA/SERVIDO) → 409.
   */
  async create(
    dto: { mesa: string; items: { menuItemId: string; qty: number; nota?: string }[]; notaMesa?: string },
  ): Promise<MenuOrder> {
    const mesaNum = dto.mesa?.trim()?.toUpperCase();
    if (!mesaNum) throw new BadRequestException('Indica el número de mesa');
    if (!dto.items?.length) throw new BadRequestException('El pedido está vacío');

    const table = await this.tables.findOneBy({ numero: mesaNum });
    if (!table) throw new BadRequestException(`La mesa ${mesaNum} no existe`);

    return this.dataSource.transaction(async (manager) => {
      // 1. Mutex: chequear pedido activo de la mesa DENTRO de la transacción.
      const active = await manager
        .getRepository(MenuOrder)
        .createQueryBuilder('o')
        .where('o.mesa = :mesa AND o.estado IN (:...estados)', {
          mesa: mesaNum,
          estados: ['ENVIADO', 'EN_COCINA', 'SERVIDO'],
        })
        .getOne();
      if (active) {
        throw new ConflictException('Esta mesa ya tiene un pedido en curso');
      }

      // 2. Cargar platos y calcular total en backend (single source of truth).
      const menuItemIds = dto.items.map((i) => i.menuItemId);
      const menuItems = await manager.getRepository(MenuItem).findBy({ id: In(menuItemIds) });
      const menuMap = new Map(menuItems.map((m) => [m.id, m]));
      const lines: OrderItemJson[] = [];
      for (const line of dto.items) {
        const item = menuMap.get(line.menuItemId);
        if (!item || !item.disponible) {
          throw new BadRequestException(`Plato no disponible: ${line.menuItemId}`);
        }
        const qty = Math.max(1, Math.floor(line.qty || 1));
        lines.push({
          menuItemId: item.id,
          nombre: item.nombre,
          qty,
          nota: line.nota?.trim() || undefined,
          precioUnitarioCents: item.precioCents,
        });
      }
      const totalCents = lines.reduce((acc, l) => acc + l.precioUnitarioCents * l.qty, 0);

      // 3. Crear pedido ENVIADO + nº legible.
      const numero = await this.nextOrderNumber(manager);
      const order = (await manager.getRepository(MenuOrder).save({
        mesa: mesaNum,
        userId: null,
        numero,
        items: lines,
        totalCents,
        estado: 'ENVIADO',
        notaMesa: dto.notaMesa?.trim() || null,
      } as any)) as MenuOrder;

      // 4. Estados por plato (view cocina plato a plato).
      for (const l of lines) {
        const menuItem = menuMap.get(l.menuItemId)!;
        await manager.getRepository(OrderItemStatus).save({
          orderId: order.id,
          menuItemId: l.menuItemId,
          nombre: l.nombre,
          estadoPlato: 'PENDIENTE',
          tiempoMedioMin: menuItem.tiempoMedioMin,
        } as any);
      }

      // 5. Mesa → OCUPADA (misma transacción: atomidad).
      table.estado = 'OCUPADA';
      await manager.getRepository(Table).save(table);

      return this.serialize(order.id);
    });
  }

  /** Pedido activo de una mesa (para seguimiento del comensal). */
  async findByTable(mesa: string): Promise<MenuOrder | null> {
    const order = await this.orders
      .createQueryBuilder('o')
      .where('o.mesa = :mesa AND o.estado IN (:...estados)', {
        mesa: mesa.trim().toUpperCase(),
        estados: ['ENVIADO', 'EN_COCINA', 'SERVIDO'],
      })
      .orderBy('o.createdAt', 'DESC')
      .getOne();
    if (!order) return null;
    return this.serialize(order.id);
  }

  /** Cola de cocina: pedidos activos con estados por plato. */
  async activeKitchen(): Promise<MenuOrder[]> {
    const orders = await this.orders
      .createQueryBuilder('o')
      .where('o.estado IN (:...estados)', { estados: ['ENVIADO', 'EN_COCINA'] })
      .orderBy('o.createdAt', 'ASC')
      .getMany();
    const out: MenuOrder[] = [];
    for (const o of orders) {
      out.push(await this.serialize(o.id));
    }
    return out;
  }

  async findById(id: string): Promise<MenuOrder> {
    return this.serialize(id);
  }

  /** Historial del comensal (totales consistentes lista ↔ detalle). */
  async listForUser(userId: string): Promise<MenuOrder[]> {
    const orders = await this.orders.find({ where: { userId }, order: { createdAt: 'DESC' } });
    const out: MenuOrder[] = [];
    for (const o of orders) {
      const s = await this.serialize(o.id);
      s.timeline = this.buildTimeline(s);
      s.puntosGanados = pointsForTotal(s.totalCents);
      out.push(s);
    }
    return out;
  }

  /** Transición validada por la máquina de estados (cocina / gerente). */
  async transition(id: string, estado: OrderStatus): Promise<MenuOrder> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.estado === estado) return this.serialize(id);
    const allowed = ORDER_TRANSITIONS[order.estado] ?? [];
    if (!allowed.includes(estado)) {
      throw new BadRequestException(
        `Transición inválida: ${ORDER_STATUS_LABELS[order.estado]} → ${ORDER_STATUS_LABELS[estado]}`,
      );
    }
    order.estado = estado;
    if (estado === 'EN_COCINA' && !order.sentToKitchenAt) order.sentToKitchenAt = new Date();
    if (estado === 'SERVIDO' && !order.servedAt) order.servedAt = new Date();
    if (estado === 'CANCELADO' && !order.cancelledAt) order.cancelledAt = new Date();
    await this.orders.save(order);

    // Cancelar un pedido activo libera la mesa.
    if (estado === 'CANCELADO') {
      await this.releaseTable(order.mesa);
    }
    const saved = await this.serialize(id);
    saved.timeline = this.buildTimeline(saved);
    return saved;
  }

  /** Cocina: marcar un plato como servido; si todos servidos → pedido SERVIDO. */
  async serveDish(id: string, menuItemId: string): Promise<MenuOrder> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.estado !== 'EN_COCINA' && order.estado !== 'ENVIADO') {
      throw new BadRequestException('Solo se pueden servir platos de pedidos en cocina');
    }
    const statuses = await this.dishStatuses.find({ where: { orderId: id } });
    const target = statuses.find((s) => s.menuItemId === menuItemId);
    if (!target) throw new NotFoundException('Plato no encontrado en este pedido');
    target.estadoPlato = 'SERVIDO';
    await this.dishStatuses.save(target);

    // Si todos los platos están servidos, el pedido pasa a SERVIDO.
    const updated = await this.dishStatuses.find({ where: { orderId: id } });
    if (updated.length > 0 && updated.every((s) => s.estadoPlato === 'SERVIDO')) {
      order.estado = 'SERVIDO';
      order.servedAt = new Date();
      await this.orders.save(order);
    }
    const saved = await this.serialize(id);
    saved.timeline = this.buildTimeline(saved);
    return saved;
  }

  /**
   * Pago / cobrar cuenta — cierre del ciclo (regla A).
   * Transacción única: pedido → COBRADO, mesa → LIBRE, puntos = floor(total/10)
   * sumados al comensal + asiento en el ledger, comprobante QR + email simulado.
   */
  async pay(
    userId: string,
    orderId: string,
  ): Promise<{ order: MenuOrder; comprobante: { qrSvg: string; numero: string }; puntosGanados: number }> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(MenuOrder).findOne({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido no encontrado');
      if (order.estado === 'COBRADO' || order.estado === 'CANCELADO') {
        throw new ConflictException('Este pedido ya está cerrado');
      }
      const user = await manager.getRepository(User).findOneBy({ id: userId });
      if (!user) throw new NotFoundException('Usuario no encontrado');

      order.estado = 'COBRADO';
      order.paidAt = new Date();
      order.userId = userId;
      await manager.getRepository(MenuOrder).save(order);

      // Mesa → LIBRE en la misma transacción.
      const table = await manager.getRepository(Table).findOneBy({ numero: order.mesa });
      if (table) {
        table.estado = 'LIBRE';
        await manager.getRepository(Table).save(table);
      }

      // Puntos derivados del importe real (regla F): 1 punto por cada 10 €.
      const puntos = pointsForTotal(order.totalCents);
      if (puntos > 0) {
        user.puntosAcumulados = (user.puntosAcumulados ?? 0) + puntos;
        await manager.getRepository(User).save(user);
        await manager.getRepository(LoyaltyLedger).save({
          userId: user.id,
          delta: puntos,
          concepto: 'PEDIDO',
          orderId: order.id,
          totalRecomCents: order.totalCents,
        } as any);
      }

      // Comprobante fuera de la web: QR + email simulado.
      const qrSvg = generateQrSvg(`${order.numero}|${order.totalCents}|${order.paidAt.toISOString()}`);
      await manager.getRepository(EmailLog).save({
        orderId: order.id,
        toEmail: user.email,
        type: 'recipt',
      } as any);

      const saved = await manager.getRepository(MenuOrder).findOne({
        where: { id: order.id },
        relations: { dishStatuses: true },
      });
      if (saved) {
        saved.timeline = this.buildTimeline(saved);
        saved.puntosGanados = puntos;
      }
      return { order: saved ?? order, comprobante: { qrSvg, numero: order.numero }, puntosGanados: puntos };
    });
  }

  /** Liberar mesa si el pedido activo que la ocupa ya no existe. */
  private async releaseTable(mesa: string): Promise<void> {
    const table = await this.tables.findOneBy({ numero: mesa });
    if (!table) return;
    const stillActive = await this.orders
      .createQueryBuilder('o')
      .where('o.mesa = :mesa AND o.estado IN (:...estados)', {
        mesa,
        estados: ['ENVIADO', 'EN_COCINA', 'SERVIDO'],
      })
      .getCount();
    if (stillActive === 0 && table.estado === 'OCUPADA') {
      table.estado = 'LIBRE';
      await this.tables.save(table);
    }
  }

  private async nextOrderNumber(manager: import('typeorm').EntityManager): Promise<string> {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `${yyyy}-${mm}${dd}-`;
    const last = (await manager
      .getRepository(MenuOrder)
      .createQueryBuilder('o')
      .select('o.numero', 'numero')
      .where('o.numero LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.numero', 'DESC')
      .getRawOne()) as { numero: string } | undefined;
    let seq = 1;
    if (last) {
      const parts = last.numero.split('-');
      seq = Number(parts[parts.length - 1]) + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}