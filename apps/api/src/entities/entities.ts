import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

// ── Tipos de rol y estado ────────────────────────────────────────────────
export type UserRole = 'COMENSAL' | 'COCINA' | 'GERENTE';
export type OrderStatus = 'ENVIADO' | 'EN_COCINA' | 'SERVIDO' | 'COBRADO' | 'CANCELADO';
export type TableStatus = 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'SUCIO';
export type ReservationStatus = 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'VENCIDA';
export type DishStatus = 'PENDIENTE' | 'EN_PREPARACION' | 'SERVIDO';

/** Etiqueta ES SIEMPRE derivada del enum en el frontend — nunca se guarda. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ENVIADO: 'Enviado a cocina',
  EN_COCINA: 'En cocina',
  SERVIDO: 'Servido',
  COBRADO: 'Cobrado',
  CANCELADO: 'Cancelado',
};

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  RESERVADA: 'Reservada',
  SUCIO: 'Por limpiar',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDIENTE: 'Pendiente de confirmar',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
};

/** Máquina de estados del pedido: ENVIADO → EN_COCINA → SERVIDO → COBRADO (→ CANCELADO desde ENVIADO/EN_COCINA). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ENVIADO: ['EN_COCINA', 'CANCELADO'],
  EN_COCINA: ['SERVIDO', 'CANCELADO'],
  SERVIDO: ['COBRADO'],
  COBRADO: [],
  CANCELADO: [],
};

/** Transiciones de reserva: PENDIENTE → CONFIRMADA → COMPLETADA; PENDIENTE → VENCIDA (sweeper); PENDIENTE/CONFIRMADA → CANCELADA. */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDIENTE: ['CONFIRMADA', 'CANCELADA', 'VENCIDA'],
  CONFIRMADA: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: [],
  VENCIDA: [],
};

/** Regla de fidelidad: 1 punto por cada 10 € del importe real del pedido (regla F). */
export function pointsForTotal(totalCents: number): number {
  return Math.floor(totalCents / 1000);
}

export interface OrderItemJson {
  menuItemId: string;
  nombre: string;
  qty: number;
  nota?: string;
  precioUnitarioCents: number;
}

// ── Entidades ────────────────────────────────────────────────────────────

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ unique: true, length: 190 })
  email: string;

  @Column({ unique: true, length: 60 })
  username: string;

  @Exclude()
  @Column({ length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', default: 'COMENSAL' })
  rol: UserRole;

  @Column({ type: 'int', default: 0 })
  puntosAcumulados: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ length: 40, default: 'utensils' })
  icono: string;
}

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({ type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column({ length: 140 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  /** Precio en céntimos — dinero con 2 decimales, nunca float (numeric(10,2) en Neon). */
  @Column({ type: 'int' })
  precioCents: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagenUrl: string;

  /** simple-json: array de etiquetas de dieta, p.ej. ["vegano","sinGluten"] (JSONB en Neon). */
  @Column({ type: 'simple-json', default: () => "'[]'" })
  tags: string[];

  /** simple-json: array de alérgenos, p.ej. ["gluten","frutosSecos"]. */
  @Column({ type: 'simple-json', default: () => "'[]'" })
  alergenos: string[];

  @Column({ default: false })
  picante: boolean;

  @Column({ default: true })
  disponible: boolean;

  @Column({ type: 'int', default: 12 })
  tiempoMedioMin: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nº legible de mesa: M-1 … M-16 */
  @Column({ unique: true, length: 12 })
  numero: string;

  @Column({ type: 'int' })
  capacidad: number;

  @Column({ type: 'varchar', default: 'LIBRE' })
  estado: TableStatus;

  @Column({ type: 'varchar', length: 30, default: 'interior' })
  ubicacion: string;
}

@Entity('orders')
@Index(['mesa', 'estado'])
@Index(['userId', 'createdAt'])
@Index(['estado', 'createdAt'])
export class MenuOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nº legible A-042 (SERIAL en Neon, secuencia manual en SQLite). */
  @Column({ unique: true, length: 16 })
  numero: string;

  @Column({ length: 12 })
  mesa: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  /** simple-json: [{menuItemId, nombre, qty, nota, precioUnitarioCents}] */
  @Column({ type: 'simple-json' })
  items: OrderItemJson[];

  /** Total calculado en backend (single source of truth). */
  @Column({ type: 'int' })
  totalCents: number;

  @Column({ type: 'varchar', default: 'ENVIADO' })
  estado: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notaMesa: string;

  @Column({ type: 'datetime', nullable: true })
  sentToKitchenAt: Date;

  @Column({ type: 'datetime', nullable: true })
  servedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @OneToMany(() => OrderItemStatus, (oi: OrderItemStatus) => oi.order)
  dishStatuses?: OrderItemStatus[];

  puntosGanados?: number;
  timeline?: OrderTimelineEvent[];
}

@Entity('order_item_status')
export class OrderItemStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MenuOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: MenuOrder;

  @Column()
  orderId: string;

  @Column()
  menuItemId: string;

  @Column({ length: 140 })
  nombre: string;

  @Column({ type: 'varchar', default: 'PENDIENTE' })
  estadoPlato: DishStatus;

  @Column({ type: 'int', default: 12 })
  tiempoMedioMin: number;
}

@Entity('reservations')
@Index(['fechaReserva', 'horaInicio'])
@Index(['estado', 'expiresAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Table, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column()
  tableId: string;

  /** Día de la reserva (solo fecha, YYYY-MM-DD). */
  @Column({ type: 'varchar', length: 10 })
  fechaReserva: string;

  /** Slot de inicio, HH:mm (TZ del negocio Europe/Madrid). */
  @Column({ type: 'varchar', length: 5 })
  horaInicio: string;

  @Column({ type: 'varchar', length: 5 })
  horaFin: string;

  @Column({ type: 'int' })
  numComensales: number;

  @Column({ type: 'varchar', default: 'PENDIENTE' })
  estado: ReservationStatus;

  /** Calculado EN SERVIDOR: createdAt + 15 min (regla B). */
  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

@Entity('loyalty_ledger')
export class LoyaltyLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** Puntos delta (+ ganados por pedido). */
  @Column({ type: 'int' })
  delta: number;

  @Column({ length: 40, default: 'PEDIDO' })
  concepto: string;

  @Column({ type: 'varchar', nullable: true })
  orderId: string | null;

  /** Total base (€) del pedido que generó los puntos — trazabilidad regla F. */
  @Column({ type: 'int' })
  totalRecomCents: number;

  @CreateDateColumn({ type: 'datetime' })
  ts: Date;
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  orderId: string | null;

  @Column({ length: 190 })
  toEmail: string;

  @Column({ length: 40, default: 'recipt' })
  type: string;

  @CreateDateColumn({ type: 'datetime' })
  sentAt: Date;
}

export interface OrderTimelineEvent {
  estado: OrderStatus;
  label: string;
  at: string;
}