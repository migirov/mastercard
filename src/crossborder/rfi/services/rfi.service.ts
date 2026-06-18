import { Injectable } from '@nestjs/common';
import { mcPath } from '../../common/mc-paths';
import { CrossBorderGateway } from '../../common/gateway/cross-border.gateway';
import { RfiDocumentUploadRequestDto } from '../dto/rfi-document-upload-request.dto';
import { RfiUpdateRequestDto } from '../dto/rfi-update-request.dto';

/** RFI (Request for Information): retrieve/answer a request, up/download documents. */
@Injectable()
export class RfiService {
  constructor(private readonly gw: CrossBorderGateway) {}

  /**
   * Получить текущее состояние RFI-запроса (GET). Путь — с partner-id; requestId
   * уже проверен SafeIdPipe в контроллере. Тела/шифрования нет → на sandbox
   * проверяемо (стаб: request-id с префиксом `33…` → статус OPEN).
   */
  retrieveRfi(tenantId: string, requestId: string) {
    return this.gw.run(tenantId, 'retrieveRfi', (c) => ({
      method: 'GET',
      path: mcPath.rfiRequest(this.gw.partner(c), requestId),
    }));
  }

  /**
   * Отправить ответ Customer'а на RFI-запрос (POST, обязательный шаг ответа).
   * Тело (обёртка updateRequest) шифруется в MTF/Prod интерцептором. requestId
   * проверен SafeIdPipe.
   */
  updateRfi(tenantId: string, requestId: string, body: RfiUpdateRequestDto) {
    return this.gw.run(tenantId, 'updateRfi', (c) => ({
      method: 'POST',
      path: mcPath.rfiRequest(this.gw.partner(c), requestId),
      body,
    }));
  }

  /**
   * Загрузить документ (<1 MB) в RFI-систему (POST). MC возвращает documentId,
   * который затем линкуется к запросу через updateRfi. Тело (base64 в обёртке
   * uploadDocumentRequest) шифруется в MTF/Prod интерцептором.
   */
  uploadRfiDocument(tenantId: string, body: RfiDocumentUploadRequestDto) {
    return this.gw.run(tenantId, 'uploadRfiDocument', (c) => ({
      method: 'POST',
      path: mcPath.rfiDocuments(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Скачать документ, приложенный к RFI-запросу (GET). documentId проверен
   * SafeIdPipe. Ответ (base64 в обёртке downloadDocumentResponse) расшифровывается
   * интерцептором в MTF/Prod.
   */
  downloadRfiDocument(tenantId: string, documentId: string) {
    return this.gw.run(tenantId, 'downloadRfiDocument', (c) => ({
      method: 'GET',
      path: mcPath.rfiDocument(this.gw.partner(c), documentId),
    }));
  }
}
