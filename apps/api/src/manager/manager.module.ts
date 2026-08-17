import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuOrder, Table } from '../entities/entities';
import { AuthModule } from '../auth/auth.module';
import { ManagerService } from './manager.service';
import { ManagerController } from './manager.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuOrder, Table]), AuthModule],
  controllers: [ManagerController],
  providers: [ManagerService],
})
export class ManagerModule {}