import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: { tableId: string; fecha: string; hora: string; numComensales: number }) {
    return this.reservations.create(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthenticatedUser, @Query('fecha') fecha?: string) {
    if (user.rol === 'GERENTE') return this.reservations.listForHost(fecha || undefined);
    return this.reservations.listForUser(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservations.findForUser(user.id, id);
  }

  @Patch(':id/confirm')
  @UseGuards(Roles('GERENTE'))
  confirm(@Param('id') id: string) {
    return this.reservations.confirm(id);
  }

  @Patch(':id/complete')
  @UseGuards(Roles('GERENTE'))
  complete(@Param('id') id: string) {
    return this.reservations.complete(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservations.cancel(user.id, id);
  }
}