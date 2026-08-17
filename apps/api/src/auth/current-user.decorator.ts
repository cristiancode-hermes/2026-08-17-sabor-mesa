import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../entities/entities';

export interface AuthenticatedUser {
  id: string;
  username: string;
  rol: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);