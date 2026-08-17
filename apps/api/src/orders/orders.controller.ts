import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { OrderStatus } from '../entities/entities';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Comensal: enviar pedido a la mesa (mutex 409 si ya hay pedido activo). */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: { mesa: string; items: { menuItemId: string; qty: number; nota?: string }[]; notaMesa?: string }) {
    return this.orders.create(dto);
  }

  /** Seguimiento en vivo del pedido de una mesa. */
  @Get('table/:mesa')
  table(@Param('mesa') mesa: string) {
    return this.orders.findByTable(mesa);
  }

  /** Cola de cocina. */
  @Get('active')
  @UseGuards(Roles('COCINA', 'GERENTE'))
  active() {
    return this.orders.activeKitchen();
  }

  /** Historial del comensal. */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForUser(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  /** Transición validada de la máquina de estados (cocina/gerente). */
  @Patch(':id/status')
  @UseGuards(Roles('COCINA', 'GERENTE'))
  transition(@Param('id') id: string, @Body() dto: { estado: OrderStatus }) {
    return this.orders.transition(id, dto.estado);
  }

  /** Cocina: marcar plato servido (al servirlos todos → pedido SERVIDO). */
  @Patch(':id/serve-dish')
  @UseGuards(Roles('COCINA', 'GERENTE'))
  serveDish(@Param('id') id: string, @Body() dto: { menuItemId: string }) {
    return this.orders.serveDish(id, dto.menuItemId);
  }

  /** Cierre del ciclo: cobrar cuenta → comprobante QR + puntos. */
  @Post(':id/pay')
  @UseGuards(JwtAuthGuard)
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.pay(user.id, id);
  }
}