import { Injectable } from '@nestjs/common';
import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../../xbs/common/gateway/gateway.client';
import { Source } from '../../../xbs/common/source';
import { liveOrDemo } from '../../../xbs/common/live-or-demo';
import { asString, pick } from '../../../xbs/common/parse.util';
import { RfiRespondDto } from '../dto/rfi-respond.dto';
import { RfiDocumentDto } from '../dto/rfi-document.dto';

/** A single question an RFI asks the sender to answer / evidence. */
export interface RfiQuestion {
  code: string;
  label: string;
  required: boolean;
}

export interface RfiRequestResponse {
  requestId: string;
  status: string;
  questions: RfiQuestion[];
  source: Source;
}

export interface RfiStateResponse {
  requestId: string;
  state: string;
  source: Source;
}

export interface RfiDocumentResponse {
  documentId: string;
  fileName: string;
  state: string;
  source: Source;
}

/**
 * RFI Center (Request For Information): retrieve an open RFI, submit a sender response,
 * and upload a supporting document. Each method follows the shared `liveOrDemo` shape —
 * in `live` mode hit the gateway, on any miss fall back to synthesized demo data.
 *
 * NOTE: the MC sandbox does not onboard RFI today (it answers 401/050007, which the
 * gateway masks as a 502 → `res.ok` false), so live attempts gracefully degrade to demo.
 */
@Injectable()
export class RfiService {
  constructor(
    private readonly cfg: McConfig,
    private readonly gw: GatewayClient,
  ) {}

  /** Retrieve an RFI request and the questions it asks the sender to answer. */
  async retrieve(requestId: string): Promise<RfiRequestResponse> {
    return liveOrDemo(
      this.cfg.featureMode('rfi') === 'live',
      () => this.tryRetrieve(requestId),
      () => this.demoRetrieve(requestId),
    );
  }

  private async tryRetrieve(
    requestId: string,
  ): Promise<RfiRequestResponse | undefined> {
    const res = await this.gw.call({
      method: 'GET',
      path: `/crossborder/rfi/requests/${encodeURIComponent(requestId)}`,
    });
    if (!res.ok) return undefined;
    const status = asString(pick(res.data, 'status')) ?? 'PENDING';
    return { requestId, status, questions: [], source: 'live' };
  }

  private demoRetrieve(requestId: string): RfiRequestResponse {
    return {
      requestId,
      status: 'PENDING',
      questions: [
        {
          code: 'SENDER_ID',
          label: 'Sender identification document',
          required: true,
        },
        { code: 'PURPOSE', label: 'Purpose of payment', required: true },
        {
          code: 'SOURCE_OF_FUNDS',
          label: 'Source of funds declaration',
          required: false,
        },
      ],
      source: 'demo',
    };
  }

  /** Submit the sender's response to an RFI request. */
  async respond(
    requestId: string,
    body: RfiRespondDto,
  ): Promise<RfiStateResponse> {
    return liveOrDemo(
      this.cfg.featureMode('rfi') === 'live',
      () => this.tryRespond(requestId, body),
      () => this.demoRespond(requestId),
    );
  }

  private async tryRespond(
    requestId: string,
    body: RfiRespondDto,
  ): Promise<RfiStateResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: `/crossborder/rfi/requests/${encodeURIComponent(requestId)}`,
      body: {
        updateRequest: {
          sender: { firstName: body.firstName, lastName: body.lastName },
          message: body.message,
        },
      },
    });
    if (!res.ok) return undefined;
    return { requestId, state: 'SUBMITTED', source: 'live' };
  }

  private demoRespond(requestId: string): RfiStateResponse {
    return { requestId, state: 'SUBMITTED', source: 'demo' };
  }

  /** Upload a supporting document against an RFI. */
  async uploadDocument(body: RfiDocumentDto): Promise<RfiDocumentResponse> {
    return liveOrDemo(
      this.cfg.featureMode('rfi') === 'live',
      () => this.tryUploadDocument(body),
      () => this.demoUploadDocument(body),
    );
  }

  private async tryUploadDocument(
    body: RfiDocumentDto,
  ): Promise<RfiDocumentResponse | undefined> {
    const res = await this.gw.call({
      method: 'POST',
      path: '/crossborder/rfi/documents',
      body: {
        uploadDocumentRequest: { fileName: body.fileName, file: body.file },
      },
    });
    if (!res.ok) return undefined;
    const documentId =
      asString(pick(res.data, 'documentId')) ??
      asString(pick(res.data, 'uploadDocumentResponse', 'documentId'));
    if (documentId === undefined) return undefined;
    return {
      documentId,
      fileName: body.fileName,
      state: 'UPLOADED',
      source: 'live',
    };
  }

  private demoUploadDocument(body: RfiDocumentDto): RfiDocumentResponse {
    return {
      documentId: `demo-doc-${body.fileName.length}`,
      fileName: body.fileName,
      state: 'UPLOADED',
      source: 'demo',
    };
  }
}
