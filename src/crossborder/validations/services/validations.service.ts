import { Injectable } from '@nestjs/common';
import { mcPath, EndpointGuideQuery } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { AccountValidationRequestDto } from '../dto/account-validation-request.dto';
import { AddressValidationRequestDto } from '../dto/address-validation-request.dto';
import { BankLookupRequestDto } from '../dto/bank-lookup-request.dto';
import { IbanGenerationRequestDto } from '../dto/iban-generation-request.dto';

/**
 * Pre-payment validation / lookup / reference services (Address, Account, Bank,
 * IBAN, Endpoint Guide). All identify the partner via ref headers (`mcRefHeaders`)
 * rather than a partner-id path segment.
 */
@Injectable()
export class ValidationsService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /**
   * Валидация адреса получателя (POST, до платежа). У MC СВОЯ база
   * (`/send/address-validation-service/...`) — без `/crossborder` и без partner-id
   * в пути; OAuth1-подпись всё равно ставится по creds тенанта в интерцепторе.
   */
  validateAddress(tenantId: string, body: AddressValidationRequestDto) {
    return this.gw.run(tenantId, 'validateAddress', (c) => ({
      method: 'POST',
      path: mcPath.addressValidations(),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /**
   * Валидация счёта получателя ДО платежа (POST, MC Account Validation API).
   * accountUri = { type: IBAN|PAN|BAN, value }. Путь — с partner-id (как quote).
   * На sandbox проверяемо для IBAN/CES-кейсов; ASV (requestType=ASV) в sandbox нет.
   */
  validateAccount(tenantId: string, body: AccountValidationRequestDto) {
    return this.gw.run(tenantId, 'validateAccount', (c) => ({
      method: 'POST',
      path: mcPath.accountValidations(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /** Поиск реквизитов банка получателя (POST, MC Bank Information Lookup API). */
  lookupBank(tenantId: string, body: BankLookupRequestDto) {
    return this.gw.run(tenantId, 'lookupBank', (c) => ({
      method: 'POST',
      path: mcPath.bankDetails(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /** Генерация IBAN из реквизитов счёта (POST, MC IBAN Generation API). */
  generateIban(tenantId: string, body: IbanGenerationRequestDto) {
    return this.gw.run(tenantId, 'generateIban', (c) => ({
      method: 'POST',
      path: mcPath.generateIbans(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /**
   * Endpoint Guide (GET): технические/бизнес-требования к полям для конкретного
   * коридора (payment_type + destination_country/currency/payment_instrument).
   * База `/crossborder` (без /send, без partner-id в пути); идентификация —
   * ref-заголовками (X-Mc-Correlation-Id + Partner-Ref-Id), как у validation-
   * сервисов. Тела запроса НЕТ → шифровать нечего → на sandbox работает вживую.
   */
  endpointGuide(tenantId: string, q: EndpointGuideQuery) {
    return this.gw.run(tenantId, 'endpointGuide', (c) => ({
      method: 'GET',
      path: mcPath.endpointGuide(this.gw.qs(q)),
      headers: this.gw.mcRefHeaders(c),
    }));
  }
}
