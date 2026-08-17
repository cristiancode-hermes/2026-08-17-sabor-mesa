import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/entities';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  username: string;
  rol: UserRole;
  puntosAcumulados: number;
}

export function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    username: u.username,
    rol: u.rol,
    puntosAcumulados: u.puntosAcumulados,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: { nombre: string; email: string; username: string; password: string }) {
    const nombre = dto.nombre?.trim();
    const email = dto.email?.trim().toLowerCase();
    const username = dto.username?.trim();
    if (!nombre || nombre.length < 2) throw new ConflictException('El nombre debe tener al menos 2 caracteres');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConflictException('Email inválido');
    if (!username || username.length < 3) throw new ConflictException('El usuario debe tener al menos 3 caracteres');
    if (!dto.password || dto.password.length < 8) throw new ConflictException('La contraseña debe tener al menos 8 caracteres');

    const existing = await this.users.findOne({ where: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email) throw new ConflictException('Ese email ya está registrado');
      throw new ConflictException('Ese usuario ya existe');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = (await this.users.save({
      nombre,
      email,
      username,
      passwordHash,
      rol: 'COMENSAL',
      puntosAcumulados: 0,
    } as any)) as User;
    return this.sign(user);
  }

  async login(identifier: string, password: string) {
    const id = identifier?.trim();
    if (!id || !password) throw new UnauthorizedException('Credenciales inválidas');
    const user = await this.users.findOne({
      where: [{ email: id.toLowerCase() }, { username: id }],
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    return this.sign(user);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException('Sesión no válida');
    return toAuthUser(user);
  }

  private sign(user: User) {
    const payload = { sub: user.id, username: user.username, rol: user.rol };
    return {
      token: this.jwt.sign(payload),
      user: toAuthUser(user),
    };
  }
}