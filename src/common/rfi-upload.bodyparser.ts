import { json as expressJson } from 'express';

/**
 * RFI Upload Document (`POST /crossborder/rfi/documents`) несёт файл в base64
 * (MC допускает до ~1MB → ~1.37MB после base64-раздувания) — глобального лимита
 * тела 256kb для него мало. Поднимаем лимит ТОЛЬКО для этого маршрута; Express
 * берёт первый сработавший парсер (он ставит `req._body`), поэтому последующий
 * глобальный 256kb-парсер этот путь пропускает, а на всех прочих маршрутах
 * остаётся строгий 256kb. Общий для main.ts (dev-харнесс) и e2e — поэтому
 * вынесен в отдельный модуль без side-effect'ов (импорт main.ts запустил бы
 * bootstrap). Должен регистрироваться ДО глобального json-парсера.
 */
export const RFI_UPLOAD_PATH = '/crossborder/rfi/documents';
export const rfiUploadBodyParser = () => expressJson({ limit: '2mb' });
