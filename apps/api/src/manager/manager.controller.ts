import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { Roles } from '../auth/guards';

@Controller('manager')
export class ManagerController {
  constructor(private readonly manager: ManagerService) {}

  @Get('stats')
  @UseGuards(Roles('GERENTE'))
  stats(@Query('fecha') fecha?: string) {
    return this.manager.stats(fecha);
  }

  @Get('revenue')
  @UseGuards(Roles('GERENTE'))
  revenue(@Query('fecha') fecha?: string) {
    return this.manager.revenue(fecha);
  }
}