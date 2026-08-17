import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../entities/entities';

export interface JwtPayload {
  sub: string;
  username: string;
  rol: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'sabor-mesa-dev-secret',
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, username: payload.username, rol: payload.rol };
  }
}