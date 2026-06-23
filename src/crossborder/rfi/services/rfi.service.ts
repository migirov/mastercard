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
   * Retrieve the current state of an RFI request (GET). The path includes
   * partner-id; requestId is already validated by SafeIdPipe in the controller.
   * There is no body/encryption → it is testable on sandbox (stub: a request-id
   * with the `33…` prefix → status OPEN).
   */
  retrieveRfi(tenantId: string, requestId: string) {
    return this.gw.run(tenantId, 'retrieveRfi', (c) => ({
      method: 'GET',
      path: mcPath.rfiRequest(this.gw.partner(c), requestId),
    }));
  }

  /**
   * Submit the Customer's response to an RFI request (POST, the mandatory answer
   * step). The body (updateRequest wrapper) is encrypted in MTF/Prod by the
   * interceptor. requestId is validated by SafeIdPipe.
   */
  updateRfi(tenantId: string, requestId: string, body: RfiUpdateRequestDto) {
    return this.gw.run(tenantId, 'updateRfi', (c) => ({
      method: 'POST',
      path: mcPath.rfiRequest(this.gw.partner(c), requestId),
      body,
    }));
  }

  /**
   * Upload a document (<1 MB) to the RFI system (POST). MC returns a documentId,
   * which is then linked to the request via updateRfi. The body (base64 in the
   * uploadDocumentRequest wrapper) is encrypted in MTF/Prod by the interceptor.
   */
  uploadRfiDocument(tenantId: string, body: RfiDocumentUploadRequestDto) {
    return this.gw.run(tenantId, 'uploadRfiDocument', (c) => ({
      method: 'POST',
      path: mcPath.rfiDocuments(this.gw.partner(c)),
      body,
    }));
  }

  /**
   * Download a document attached to an RFI request (GET). documentId is validated
   * by SafeIdPipe. The response (base64 in the downloadDocumentResponse wrapper)
   * is decrypted by the interceptor in MTF/Prod.
   */
  downloadRfiDocument(tenantId: string, documentId: string) {
    return this.gw.run(tenantId, 'downloadRfiDocument', (c) => ({
      method: 'GET',
      path: mcPath.rfiDocument(this.gw.partner(c), documentId),
    }));
  }
}
