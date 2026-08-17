import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TablesService } from './tables.service';
import { Roles } from '../auth/guards';

@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get('available')
  available(@Query('fecha') fecha?: string, @Query('hora') hora?: string, @Query('comensales') comensales?: string) {
    return this.tables.available({
      fecha: fecha ?? '',
      hora: hora ?? '',
      comensales: Number(comensales ?? 0),
    });
  }

  @Get()
  @UseGuards(Roles('GERENTE', 'COCINA'))
  all() {
    return this.tables.all();
  }
}