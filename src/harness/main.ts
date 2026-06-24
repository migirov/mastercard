import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isWeakSecret } from '../common/utils/secret-strength';

/** In production, refuse to start with weak/default secrets. */
function assertProdSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  // MC_WEBHOOK_TOKEN is now REQUIRED and must be strong: webhook authentication is
  // fail-closed inside the service itself (we don't rely on mTLS at the ingress).
  const bad = [
    'MC_JWT_SECRET',
    'MC_INTERNAL_TOKEN',
    'MC_ADMIN_TOKEN',
    'MC_WEBHOOK_TOKEN',
  ].filter((k) => isWeakSecret(process.env[k]));
  if (bad.length) {
    throw new Error(
      `production: weak/default secrets — set strong values: ${bad.join(', ')}`,
    );
  }

  // In production, partner secrets MUST come from a secret manager (Vault/KMS), not the
  // dev LocalSecretStore: otherwise OWN partners (the main scenario) would be left
  // without keys while the config silently sits on the dev store. Fail loudly at startup.
  if ((process.env.MC_SECRET_STORE ?? '') !== 'vault') {
    throw new Error(
      'production: set MC_SECRET_STORE=vault — LocalSecretStore is for dev only',
    );
  }
}

async function bootstrap() {
  assertProdSecrets();

  // Disable bodyParser so we can register the JSON parser with our own limit.
  // bufferLogs: buffer startup logs until the pino logger is attached.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  // Structured logger (pino) for the whole application + correlation-id.
  app.useLogger(app.get(PinoLogger));

  // trust proxy: behind a reverse proxy/LB, req.ip and X-Forwarded-* must reflect the
  // real client (otherwise IP rate-limiting is wrong). OFF by default (direct
  // connections). TRUST_PROXY: a number of hops or 'true'.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
    );
  }

  // Secure HTTP headers + hide x-powered-by.
  app.use(helmet());

  // Body-size limits (global json 256kb + urlencoded for the OAuth2 token RFC 6749, and
  // a raised 2mb for RFI upload) are set as Nest middleware in `AppModule.configure`
  // (RFI first), NOT here via `app.useBodyParser`: this keeps the parser order explicit
  // and controllable (Express picks the first parser that sets `req._body`).

  // NOTE: we do NOT install a global ValidationPipe — the module is embeddable, and each
  // controller declares the needed preset of ONE shared validation strategy
  // (`gatewayValidationPipe(ValidationStrategy.Strict|Passthrough)`): Strict at our
  // boundaries (admin/oauth), Passthrough on bodies going to Mastercard. This avoids
  // "double" validation, where a global strict pipe would strip MC fields.

  // Swagger docs at /api-docs. OFF by default in production (don't expose the API
  // schema outward); enable explicitly in prod via SWAGGER_ENABLED=true.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mastercard Cross-Border Gateway')
      .setDescription(
        'Multi-merchant gateway to Mastercard Cross-Border Services',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'merchant')
      .addApiKey(
        { type: 'apiKey', name: 'X-Internal-Token', in: 'header' },
        'internal',
      )
      .addApiKey(
        { type: 'apiKey', name: 'X-Admin-Token', in: 'header' },
        'admin',
      )
      .addApiKey(
        { type: 'apiKey', name: 'X-Webhook-Token', in: 'header' },
        'webhook',
      )
      .build();
    SwaggerModule.setup(
      'api-docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  // Graceful shutdown: let keep-alive connections and in-flight calls close.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Server on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // Explicitly exit the process with a non-zero code — k8s/orchestrator will see a
  // crashloop rather than a "hanging" uninitialized pod.
  new Logger('Bootstrap').error(
    `Failed to start the service: ${(err as Error).message}`,
  );
  process.exit(1);
});
