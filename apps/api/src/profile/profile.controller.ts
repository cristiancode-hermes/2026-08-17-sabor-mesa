import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('profile')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.profile(user.id);
  }
}