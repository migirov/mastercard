import { Controller, Get } from '@nestjs/common';
import { BalancesService } from '../services/balances.service';

@Controller('xbs')
export class BalancesController {
  constructor(private readonly svc: BalancesService) {}

  @Get('balances')
  balances() {
    return this.svc.balances();
  }
}
