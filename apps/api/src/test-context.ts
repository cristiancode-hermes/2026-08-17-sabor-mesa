import { DataSource, Repository } from 'typeorm';
import {
  Category,
  EmailLog,
  LoyaltyLedger,
  MenuItem,
  MenuOrder,
  OrderItemStatus,
  Reservation,
  Table,
  User,
} from './entities/entities';
import { OrdersService } from './orders/orders.service';
import { ReservationsService, RESERVATION_HOLD_MINUTES } from './reservations/reservations.service';

const ALL_ENTITIES = [
  User,
  Category,
  MenuItem,
  Table,
  MenuOrder,
  OrderItemStatus,
  Reservation,
  LoyaltyLedger,
  EmailLog,
];

function makeDataSource(): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ALL_ENTITIES,
    synchronize: true,
  } as any);
}

/** Harness de integración SQLite :memory: para el ciclo transaccional del dining. */
export async function createTestContext() {
  const ds = await makeDataSource().initialize();
  const users = ds.getRepository(User);
  const items = ds.getRepository(MenuItem);
  const categories = ds.getRepository(Category);
  const tables = ds.getRepository(Table);

  const cat = (await categories.save({ nombre: 'Principales', orden: 1, icono: 'flame' } as any)) as Category;
  const pulpo = (await items.save({
    categoryId: cat.id,
    nombre: 'Pulpo a la brasa',
    descripcion: 'Pulpo gallego con pimentón',
    precioCents: 1980,
    tags: ['sinGluten'],
    alergenos: ['marisco'],
    picante: false,
    disponible: true,
    tiempoMedioMin: 22,
  } as any)) as MenuItem;
  const fideua = (await items.save({
    categoryId: cat.id,
    nombre: 'Fideuá de marisco',
    descripcion: 'Fideos con caldo y gambas',
    precioCents: 1690,
    tags: [],
    alergenos: ['gluten', 'marisco'],
    picante: false,
    disponible: true,
    tiempoMedioMin: 25,
  } as any)) as MenuItem;
  const agua = (await items.save({
    categoryId: cat.id,
    nombre: 'Agua mineral',
    descripcion: 'Botella 50cl',
    precioCents: 250,
    tags: ['vegano', 'sinGluten'],
    alergenos: [],
    picante: false,
    disponible: true,
    tiempoMedioMin: 1,
  } as any)) as MenuItem;
  const tarta = (await items.save({
    categoryId: cat.id,
    nombre: 'Tarta de queso',
    descripcion: 'Con confitura de frutos rojos',
    precioCents: 680,
    tags: [],
    alergenos: ['gluten', 'lactosa'],
    picante: false,
    disponible: true,
    tiempoMedioMin: 5,
  } as any)) as MenuItem;

  const user = (await users.save({
    nombre: 'Test Comensal',
    email: 'test@test.dev',
    username: 'test',
    passwordHash: 'x',
    rol: 'COMENSAL',
    puntosAcumulados: 0,
  } as any)) as User;

  const t1 = (await tables.save({ numero: 'M-1', capacidad: 2, estado: 'LIBRE', ubicacion: 'terraza' } as any)) as Table;
  const t2 = (await tables.save({ numero: 'M-2', capacidad: 4, estado: 'LIBRE', ubicacion: 'interior' } as any)) as Table;

  const orders = new OrdersService(
    ds,
    ds.getRepository(MenuOrder),
    ds.getRepository(OrderItemStatus),
    ds.getRepository(MenuItem),
    ds.getRepository(Table),
    ds.getRepository(User),
    ds.getRepository(LoyaltyLedger),
    ds.getRepository(EmailLog),
  );
  const reservations = new ReservationsService(
    ds,
    ds.getRepository(Reservation),
    ds.getRepository(Table),
    ds.getRepository(User),
  );

  return { ds, orders, reservations, user, pulpo, fideua, agua, tarta, t1, t2 };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

export { RESERVATION_HOLD_MINUTES };