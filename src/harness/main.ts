import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isWeakSecret } from '../common/utils/secret-strength';

/** В production не даём стартовать со слабыми/дефолтными секретами. */
function assertProdSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  // MC_WEBHOOK_TOKEN — теперь ОБЯЗАТЕЛЕН и должен быть сильным: аутентификация
  // вебхука fail-closed в самом сервисе (не полагаемся на mTLS на ингрессе).
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

  // Секреты партнёров в проде ДОЛЖНЫ идти из секрет-менеджера (Vault/KMS), а не из
  // dev-LocalSecretStore: иначе OWN-партнёры (основной сценарий) останутся без
  // ключей, а конфиг молча окажется на дев-сторе. Падаем громко на старте.
  if ((process.env.MC_SECRET_STORE ?? '') !== 'vault') {
    throw new Error(
      'production: set MC_SECRET_STORE=vault — LocalSecretStore is for dev only',
    );
  }
}

async function bootstrap() {
  assertProdSecrets();

  // bodyParser отключаем, чтобы зарегистрировать JSON-парсер со своим лимитом.
  // bufferLogs: копим логи старта, пока не подключим pino-логгер.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  // Структурный логгер (pino) для всего приложения + correlation-id.
  app.useLogger(app.get(PinoLogger));

  // trust proxy: за обратным прокси/LB нужно, чтобы req.ip и X-Forwarded-*
  // отражали реального клиента (иначе IP-rate-limit некорректен). По умолчанию
  // OFF (прямые соединения). TRUST_PROXY: число хопов или 'true'.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
    );
  }

  // Безопасные HTTP-заголовки + скрытие x-powered-by.
  app.use(helmet());

  // Лимиты размера тела (глобальный json 256kb + urlencoded для OAuth2 token RFC 6749,
  // и увеличенный 2mb для RFI-upload) задаются как Nest middleware в `AppModule.configure`
  // (RFI — первым), а НЕ здесь через `app.useBodyParser`: так порядок парсеров явный и
  // контролируемый (Express берёт первый парсер, ставящий `req._body`).

  // ВНИМАНИЕ: глобальный ValidationPipe НЕ ставим — модуль встраиваемый, и каждый
  // контроллер объявляет нужный пресет ОДНОЙ общей стратегии валидации
  // (`gatewayValidationPipe(ValidationStrategy.Strict|Passthrough)`): Strict — на
  // наших границах (admin/oauth), Passthrough — на телах, идущих в Mastercard. Это
  // исключает «двойную» валидацию, при которой глобальный строгий pipe резал бы поля MC.

  // Swagger-доки на /api-docs. По умолчанию ВЫКЛ в production (не палим схему
  // API наружу); включить в проде явно через SWAGGER_ENABLED=true.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mastercard Cross-Border Gateway')
      .setDescription('Мульти-мерчант шлюз к Mastercard Cross-Border Services')
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

  // Грейсфул-шатдаун: дать закрыться keep-alive соединениям и in-flight вызовам.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Сервер на http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // Явно валим процесс с ненулевым кодом — k8s/оркестратор увидит crashloop,
  // а не «висящий» неинициализированный под.
  new Logger('Bootstrap').error(
    `Не удалось запустить сервис: ${(err as Error).message}`,
  );
  process.exit(1);
});
