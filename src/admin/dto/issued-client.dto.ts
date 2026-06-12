import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Ответ при выпуске OAuth-клиента. ЕДИНСТВЕННЫЙ эндпоинт, отдающий сырой
 * `client_secret` — и только ОДИН раз (в БД хранится лишь его хэш). Поля
 * `@Expose`, т.к. здесь секрет показать НАДО; `excludeExtraneousValues` в
 * контроллере гарантирует, что наружу уйдут ровно эти три поля и ничего лишнего
 * из внутреннего представления клиента.
 */
export class IssuedClientDto {
  @Expose()
  @ApiProperty({ description: 'Идентификатор OAuth-клиента.' })
  clientId!: string;

  @Expose()
  @ApiProperty({ description: 'Сырой client_secret — показан ОДИН раз.' })
  clientSecret!: string;

  @Expose()
  @ApiProperty({ description: 'Напоминание сохранить секрет.' })
  note!: string;
}
