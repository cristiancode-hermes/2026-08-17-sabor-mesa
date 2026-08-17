import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuOrder, Reservation, Table } from '../entities/entities';
import { AuthModule } from '../auth/auth.module';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Table, Reservation, MenuOrder]), AuthModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}