export type UserRole = 'COMENSAL' | 'COCINA' | 'GERENTE';
export type OrderStatus = 'ENVIADO' | 'EN_COCINA' | 'SERVIDO' | 'COBRADO' | 'CANCELADO';
export type TableStatus = 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'SUCIO';
export type ReservationStatus = 'PENDIENTE' | 'CONFIRMADA' | 'COMPLETADA' | 'CANCELADA' | 'VENCIDA';
export type DishStatus = 'PENDIENTE' | 'EN_PREPARACION' | 'SERVIDO';

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

export const ORDER_FLOW: OrderStatus[] = ['ENVIADO', 'EN_COCINA', 'SERVIDO', 'COBRADO'];

export const ALERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  lactosa: 'Lácteos',
  huevo: 'Huevo',
  frutosSecos: 'Frutos secos',
  marisco: 'Marisco',
  pescado: 'Pescado',
};

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  username: string;
  rol: UserRole;
  puntosAcumulados: number;
}

export interface Category {
  id: string;
  nombre: string;
  orden: number;
  icono: string;
}

export interface MenuItem {
  id: string;
  categoryId: string | null;
  nombre: string;
  descripcion: string | null;
  precioCents: number;
  imagenUrl: string | null;
  tags: string[];
  alergenos: string[];
  picante: boolean;
  disponible: boolean;
  tiempoMedioMin: number;
}

export interface CartLine {
  menuItemId: string;
  nombre: string;
  precioUnitarioCents: number;
  qty: number;
  nota?: string;
  imagenUrl?: string | null;
}

export interface OrderItemStatusDTO {
  id: string;
  menuItemId: string;
  nombre: string;
  estadoPlato: DishStatus;
  tiempoMedioMin: number;
}

export interface OrderItemJson {
  menuItemId: string;
  nombre: string;
  qty: number;
  nota?: string;
  precioUnitarioCents: number;
}

export interface TimelineEvent {
  estado: OrderStatus;
  label: string;
  at: string;
}

export interface MenuOrder {
  id: string;
  numero: string;
  mesa: string;
  userId: string | null;
  items: OrderItemJson[];
  totalCents: number;
  estado: OrderStatus;
  notaMesa: string | null;
  createdAt: string;
  updatedAt: string;
  dishStatuses?: OrderItemStatusDTO[];
  puntosGanados?: number;
  timeline?: TimelineEvent[];
}

export interface TableDTO {
  id: string;
  numero: string;
  capacidad: number;
  estado: TableStatus;
  ubicacion: string;
}

export interface Reservation {
  id: string;
  userId: string;
  tableId: string;
  table?: TableDTO;
  fechaReserva: string;
  horaInicio: string;
  horaFin: string;
  numComensales: number;
  estado: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface LoyaltyEntry {
  id: string;
  delta: number;
  concepto: string;
  orderId: string | null;
  totalRecomCents: number;
  ts: string;
}

export interface ManagerStats {
  fecha: string;
  ingresosCents: number;
  pedidos: number;
  platosServidos: number;
  mesas: { total: number; libres: number; ocupadas: number; reservadas: number; sucias: number };
  ticketMedioCents: number;
}

export interface RevenuePoint {
  hora: string;
  totalCents: number;
  pedidos: number;
}

export interface ProfileDTO {
  user: { id: string; nombre: string; email: string; username: string; puntosAcumulados: number };
  pedidos: {
    id: string;
    numero: string;
    mesa: string;
    totalCents: number;
    estado: OrderStatus;
    createdAt: string;
    puntosGanados: number;
    itemsCount: number;
  }[];
  reservas: Reservation[];
  stats: { totalPedidos: number; totalGastadoCents: number; puntosTotales: number };
}

/** Formatea céntimos a euros con 2 decimales. */
export function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

/** Puntos por importe: 1 punto por cada 10 € (misma regla que el backend). */
export function pointsFor(cents: number): number {
  return Math.floor(cents / 1000);
}