import { Injectable } from '@nestjs/common';
import { mcPath } from '../../mc-paths';
import { CrossBorderGateway } from '../../gateway/cross-border.gateway';

/** Cross-Border account info: balances and FX (Carded) rate pull. */
@Injectable()
export class AccountsService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /** Список счетов и балансов (GET, без шифрования). */
  getBalances(tenantId: string) {
    return this.gw.run(tenantId, 'getBalances', (c) => ({
      method: 'GET',
      path: mcPath.balances(this.gw.partner(c)),
    }));
  }

  /**
   * Carded / FX Rate Pull (GET, БЕЗ тела): FX-курсы для сконфигурированных
   * коридоров — основной механизм получения курсов до инициации платежа.
   * По доке MC это операция `getFxRates`: GET, «No Request body» (поэтому НЕ
   * POST — прежний POST-вариант убран как несуществующий у MC). Sandbox для
   * Carded Rate НЕДОСТУПЕН (по доке MC) → проверяется только проводка шлюза.
   * Push-вариант (Carded Rate Push) — вебхук на /webhooks/mastercard.
   */
  getRates(tenantId: string) {
    return this.gw.run(tenantId, 'getRates', (c) => ({
      method: 'GET',
      path: mcPath.rates(this.gw.partner(c)),
    }));
  }
}
