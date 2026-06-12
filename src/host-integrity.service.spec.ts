import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { HostIntegrityService } from './host-integrity.service';
import { MASTERCARD_ENTITIES } from './mastercard.entities';

// Заглушки хост-инфраструктуры (нам важны только проверяемые методы/наличие).
const dsWith = (hasMetadata: boolean) =>
  ({ hasMetadata: () => hasMetadata }) as unknown as DataSource;
const scheduler = {} as unknown as SchedulerRegistry;

describe('HostIntegrityService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('warns when the host did not provide a DataSource', () => {
    new HostIntegrityService(undefined, scheduler).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DataSource'));
  });

  it('warns naming entities missing from the host DataSource', () => {
    new HostIntegrityService(dsWith(false), scheduler).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(MASTERCARD_ENTITIES[0].name),
    );
  });

  it('warns when ScheduleModule (SchedulerRegistry) is absent', () => {
    new HostIntegrityService(dsWith(true), undefined).onApplicationBootstrap();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ScheduleModule'),
    );
  });

  it('stays silent when DataSource has all entities and scheduler is present', () => {
    new HostIntegrityService(dsWith(true), scheduler).onApplicationBootstrap();
    expect(warn).not.toHaveBeenCalled();
  });
});
