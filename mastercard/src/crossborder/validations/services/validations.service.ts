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
   * Validate the recipient address (POST, before payment). MC uses its OWN base
   * (`/send/address-validation-service/...`) — without `/crossborder` and without
   * a partner-id in the path; the OAuth1 signature is still applied from the
   * tenant's creds in the interceptor.
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
   * Validate the recipient account BEFORE payment (POST, MC Account Validation
   * API). accountUri = { type: IBAN|PAN|BAN, value }. The path includes partner-id
   * (like quote). On sandbox this is testable for IBAN/CES cases; ASV
   * (requestType=ASV) is not available on sandbox.
   */
  validateAccount(tenantId: string, body: AccountValidationRequestDto) {
    return this.gw.run(tenantId, 'validateAccount', (c) => ({
      method: 'POST',
      path: mcPath.accountValidations(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /** Look up the recipient bank's details (POST, MC Bank Information Lookup API). */
  lookupBank(tenantId: string, body: BankLookupRequestDto) {
    return this.gw.run(tenantId, 'lookupBank', (c) => ({
      method: 'POST',
      path: mcPath.bankDetails(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /** Generate an IBAN from account details (POST, MC IBAN Generation API). */
  generateIban(tenantId: string, body: IbanGenerationRequestDto) {
    return this.gw.run(tenantId, 'generateIban', (c) => ({
      method: 'POST',
      path: mcPath.generateIbans(this.gw.partner(c)),
      body,
      headers: this.gw.mcRefHeaders(c),
    }));
  }

  /**
   * Endpoint Guide (GET): technical/business field requirements for a specific
   * corridor (payment_type + destination_country/currency/payment_instrument).
   * Base `/crossborder` (without /send, without a partner-id in the path);
   * identification is via ref headers (X-Mc-Correlation-Id + Partner-Ref-Id), like
   * the validation services. There is NO request body → nothing to encrypt → it
   * works live on sandbox.
   */
  endpointGuide(tenantId: string, q: EndpointGuideQuery) {
    return this.gw.run(tenantId, 'endpointGuide', (c) => ({
      method: 'GET',
      path: mcPath.endpointGuide(this.gw.qs(q)),
      headers: this.gw.mcRefHeaders(c),
    }));
  }
}
