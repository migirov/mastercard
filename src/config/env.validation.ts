import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Схема переменных окружения. Валидируется ОДИН раз на старте (ConfigModule
 * `validate`), fail-fast — вместо разбросанных ленивых `throw` при первом доступе.
 * Условные переменные (ключи шифрования при MC_ENCRYPTION_ENABLED=true и т.п.)
 * остаются опциональными здесь и проверяются в месте использования.
 */
class EnvVars {
  // --- обязательные всегда ---
  @IsString() @IsNotEmpty() MC_BASE_URL!: string;
  @IsString() @IsNotEmpty() MC_CONSUMER_KEY!: string;
  @IsString() @IsNotEmpty() MC_PARTNER_ID!: string;
  @IsString() @IsNotEmpty() MC_SIGNING_KEY_PATH!: string;
  @IsString() @IsNotEmpty() MC_SIGNING_KEY_PASSWORD!: string;
  @IsString() @IsNotEmpty() DATABASE_URL!: string;
  @IsString() @MinLength(16) MC_JWT_SECRET!: string;
  @IsString() @IsNotEmpty() MC_INTERNAL_TOKEN!: string;
  @IsString() @IsNotEmpty() MC_ADMIN_TOKEN!: string;

  // --- опциональные / с дефолтами (проверяем формат, если заданы) ---
  @IsOptional() @IsIn(['true', 'false']) MC_ENCRYPTION_ENABLED?: string;
  @IsOptional() @IsIn(['local', 'vault']) MC_SECRET_STORE?: string;
  @IsOptional() @IsIn(['true', 'false']) DB_SYNC?: string;
  @IsOptional() @IsNumberString() DB_POOL_MAX?: string;
  @IsOptional() @IsString() MC_ENCRYPTION_CERT_PATH?: string;
  @IsOptional() @IsString() MC_ENCRYPTION_FINGERPRINT?: string;
  @IsOptional() @IsString() MC_DECRYPTION_KEY_PATH?: string;
  @IsOptional() @IsString() MC_WEBHOOK_TOKEN?: string;
  @IsOptional() @IsString() TRUST_PROXY?: string;
}

/** ConfigModule `validate`: бросает с понятным сообщением, если .env невалиден. */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = plainToInstance(EnvVars, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid .env configuration: ${details}`);
  }
  // Возвращаем исходный config (а не instance) — чтобы НЕ задекларированные здесь
  // переменные (NODE_ENV, PORT, PoC-ключи и т.п.) остались доступны в ConfigService.
  return config;
}
