import { json as expressJson, RequestHandler } from 'express';

/**
 * RFI Upload Document (`POST /crossborder/rfi/documents`) несёт файл в base64
 * (MC допускает до ~1MB → ~1.37MB после base64-раздувания) — глобального лимита
 * тела 256kb для него мало. Поднимаем лимит ТОЛЬКО для этого маршрута; Express
 * берёт первый сработавший парсер (он ставит `req._body`), поэтому последующий
 * глобальный 256kb-парсер этот путь пропускает, а на всех прочих маршрутах
 * остаётся строгий 256kb. Общий для main.ts (dev-харнесс) и e2e — поэтому
 * вынесен в отдельный модуль без side-effect'ов (импорт main.ts запустил бы
 * bootstrap). Должен регистрироваться ДО глобального json-парсера.
 *
 * ⚠️ Встраивание: при работе модулем в чужом монолите `main.ts` НЕ выполняется —
 * хост обязан сам зарегистрировать этот парсер (см. README host-checklist), иначе
 * RFI-upload упрётся в глобальный лимит тела хоста (413). Поэтому экспортируем
 * путь + фабрику как часть публичного контракта.
 */
export const RFI_UPLOAD_PATH = '/crossborder/rfi/documents';

export const rfiUploadBodyParser = (): RequestHandler => {
  const json = expressJson({ limit: '2mb' });
  // `app.use(path, …)` матчит ПО ПРЕФИКСУ — задел бы и `…/documents/:id`
  // (download, GET). Применяем увеличенный лимит строго к POST-загрузке, чтобы
  // другие методы/подпути не наследовали 2MB.
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    return json(req, res, next);
  };
};
