import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../entities/entities';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class RoleGuard extends AuthGuard('jwt') {
  constructor(private readonly roles: UserRole[]) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const ok = await super.canActivate(context);
    if (!ok) return false;
    const req = context.switchToHttp().getRequest();
    return !!(req.user && this.roles.includes(req.user.rol));
  }
}

export function Roles(...roles: UserRole[]) {
  return new RoleGuard(roles);
}