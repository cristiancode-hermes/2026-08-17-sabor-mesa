import { Controller, Get, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('ledger')
  @UseGuards(JwtAuthGuard)
  ledger(@CurrentUser() user: AuthenticatedUser) {
    return this.loyalty.ledgerFor(user.id);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.loyalty.summary(user.id);
  }
}