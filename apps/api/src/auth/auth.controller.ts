import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import { CurrentUser, AuthenticatedUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: { nombre: string; email: string; username: string; password: string }) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: { identifier: string; password: string }) {
    return this.auth.login(dto.identifier, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}