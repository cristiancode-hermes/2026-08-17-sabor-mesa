import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog, LoyaltyLedger, MenuItem, MenuOrder, OrderItemStatus, Table, User } from '../entities/entities';
import { AuthModule } from '../auth/auth.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuOrder, OrderItemStatus, MenuItem, Table, User, LoyaltyLedger, EmailLog]),
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}