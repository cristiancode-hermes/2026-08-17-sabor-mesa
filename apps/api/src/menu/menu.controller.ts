import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('categories')
  categories() {
    return this.menu.listCategories();
  }

  @Get('items')
  items(
    @Query('category') category?: string,
    @Query('vegan') vegan?: string,
    @Query('glutenFree') glutenFree?: string,
  ) {
    return this.menu.listItems({
      categoryId: category || undefined,
      vegan: vegan === 'true' || vegan === '1',
      glutenFree: glutenFree === 'true' || glutenFree === '1',
    });
  }

  @Get('items/:id')
  item(@Param('id') id: string) {
    return this.menu.findOne(id);
  }

  @Get('search')
  search(@Query('q') q?: string) {
    return this.menu.search(q ?? '');
  }
}