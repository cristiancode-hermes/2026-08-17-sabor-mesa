import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { TablesModule } from './tables/tables.module';
import { ReservationsModule } from './reservations/reservations.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ProfileModule } from './profile/profile.module';
import { ManagerModule } from './manager/manager.module';
import { SeedModule } from './seed/seed.module';
import { SweeperService } from './sweeper/sweeper.service';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DATABASE_TYPE', 'better-sqlite3');
        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            url: config.get<string>('DATABASE_URL'),
            entities: ALL_ENTITIES,
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          } as any;
        }
        return {
          type: 'better-sqlite3',
          database: config.get<string>('DATABASE_PATH', 'data/sabor-mesa.db'),
          entities: ALL_ENTITIES,
          synchronize: true,
        } as any;
      },
    }),
    AuthModule,
    MenuModule,
    OrdersModule,
    TablesModule,
    ReservationsModule,
    LoyaltyModule,
    ProfileModule,
    ManagerModule,
    SeedModule,
  ],
  providers: [SweeperService],
})
export class AppModule {}