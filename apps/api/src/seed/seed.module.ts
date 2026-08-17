import { Module } from '@nestjs/common';
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
} from '../entities/entities';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      MenuItem,
      Table,
      MenuOrder,
      OrderItemStatus,
      Reservation,
      LoyaltyLedger,
      EmailLog,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}