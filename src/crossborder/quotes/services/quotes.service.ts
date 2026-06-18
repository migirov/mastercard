import { Injectable } from '@nestjs/common';
import { mcPath } from '../../mc-paths';
import { CrossBorderGateway } from '../../gateway/cross-border.gateway';
import { ConfirmationRequestDto } from '../dto/confirmation-request.dto';
import { QuoteRequestDto } from '../dto/quote-request.dto';

/** Cross-Border quotes: request, confirm, cancel and retrieve a confirmed quote. */
@Injectable()
export class QuotesService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /**
   * Запрос котировки (POST). Шифрование тела (MTF/Prod) и подпись — прозрачно
   * в axios-интерцепторе `MastercardClient`; здесь отдаём чистый объект.
   */
  createQuote(tenantId: string, body: QuoteRequestDto) {
    return this.gw.run(tenantId, 'createQuote', (c) => ({
      method: 'POST',
      path: mcPath.quotes(this.gw.partner(c)),
      body,
    }));
  }

  /** Подтверждение котировки (POST). Шифрование — в интерцепторе. */
  confirmQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.gw.run(tenantId, 'confirmQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteConfirmations(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Отмена ПОДТВЕРЖДЁННОЙ котировки (POST). Тело идентично подтверждению
   * (`{ transactionReference, proposalId }`) → переиспользуем ConfirmationRequestDto.
   * До инициации платежа → возврат зарезервированных средств; после — MC отклонит.
   * Шифрование тела (MTF/Prod) — в интерцепторе.
   */
  cancelConfirmedQuote(tenantId: string, body: ConfirmationRequestDto) {
    return this.gw.run(tenantId, 'cancelConfirmedQuote', (c) => ({
      method: 'POST',
      path: mcPath.quoteCancellations(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Просмотр подтверждённой котировки (GET). ref/proposalId уже проверены
   * SafeIdPipe в контроллере. Тела/шифрования запроса нет; ответ расшифровывается
   * интерцептором в MTF/Prod.
   */
  retrieveConfirmedQuote(tenantId: string, ref: string, proposalId: string) {
    return this.gw.run(tenantId, 'retrieveConfirmedQuote', (c) => ({
      method: 'GET',
      path: mcPath.retrieveConfirmedQuote(this.gw.partner(c), ref, proposalId),
    }));
  }
}
