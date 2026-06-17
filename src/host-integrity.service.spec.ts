import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GatewayConfig } from './config/gateway-config';
import { HostIntegrityService } from './host-integrity.service';
import { MASTERCARD_ENTITIES } from './mastercard.entities';

// Заглушки хост-инфраструктуры (нам важны только проверяемые методы/наличие).
const dsWith = (hasMetadata: boolean) =>
  ({ hasMetadata: () => hasMetadata }) as unknown as DataSource;
// Конфиг с заданным webhookToken (чтобы не срабатывал webhook-WARN, если не цель теста).
const cfg = (webhookToken = 'wh-token') =>
  ({ webhookToken }) as unknown as GatewayConfig;

describe('HostIntegrityService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('warns when the host did not provide a DataSource', () => {
    new HostIntegrityService(cfg(), undefined).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DataSource'));
  });

  it('warns naming entities missing from the host DataSource', () => {
    new HostIntegrityService(cfg(), dsWith(false)).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(MASTERCARD_ENTITIES[0].name),
    );
  });

  it('warns when webhookToken is empty (intake disabled)', () => {
    new HostIntegrityService(cfg(''), dsWith(true)).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('webhookToken'));
  });

  it('stays silent when host provides all infra and webhookToken is set', () => {
    new HostIntegrityService(cfg(), dsWith(true)).onApplicationBootstrap();
    expect(warn).not.toHaveBeenCalled();
  });
});
