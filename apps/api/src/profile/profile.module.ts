import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuOrder, Reservation, User } from '../entities/entities';
import { AuthModule } from '../auth/auth.module';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuOrder, Reservation, User]), AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}