import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, MenuItem } from '../entities/entities';

export interface MenuItemDTO {
  id: string;
  categoryId: string | null;
  nombre: string;
  descripcion: string | null;
  precioCents: number;
  imagenUrl: string | null;
  tags: string[];
  alergenos: string[];
  picante: boolean;
  disponible: boolean;
  tiempoMedioMin: number;
}

export function toMenuItemDTO(m: MenuItem): MenuItemDTO {
  return {
    id: m.id,
    categoryId: m.categoryId,
    nombre: m.nombre,
    descripcion: m.descripcion,
    precioCents: m.precioCents,
    imagenUrl: m.imagenUrl,
    tags: m.tags ?? [],
    alergenos: m.alergenos ?? [],
    picante: m.picante,
    disponible: m.disponible,
    tiempoMedioMin: m.tiempoMedioMin,
  };
}

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
  ) {}

  async listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { orden: 'ASC' } });
  }

  async listItems(opts: { categoryId?: string; vegan?: boolean; glutenFree?: boolean }): Promise<MenuItemDTO[]> {
    const qb = this.items.createQueryBuilder('m').where('m.disponible = 1');
    if (opts.categoryId) qb.andWhere('m.categoryId = :cat', { cat: opts.categoryId });
    const rows = await qb.orderBy('m.nombre', 'ASC').getMany();
    let filtered = rows;
    if (opts.vegan) filtered = filtered.filter((m) => (m.tags ?? []).includes('vegano'));
    if (opts.glutenFree) filtered = filtered.filter((m) => (m.tags ?? []).includes('sinGluten'));
    return filtered.map(toMenuItemDTO);
  }

  async findOne(id: string): Promise<MenuItemDTO> {
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Plato no encontrado');
    return toMenuItemDTO(item);
  }

  async search(q: string): Promise<MenuItemDTO[]> {
    const term = q?.trim().toLowerCase();
    if (!term) return [];
    const rows = await this.items.find({ where: { disponible: true } });
    return rows
      .filter(
        (m) =>
          m.nombre.toLowerCase().includes(term) ||
          (m.descripcion ?? '').toLowerCase().includes(term) ||
          (m.tags ?? []).some((t) => t.toLowerCase().includes(term)),
      )
      .map(toMenuItemDTO)
      .slice(0, 12);
  }
}