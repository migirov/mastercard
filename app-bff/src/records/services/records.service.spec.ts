import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordsService } from './records.service';
import { RecordEntity } from '../entities/record.entity';

/**
 * Unit specs for the entity store's non-trivial logic: the list limit-cap, the
 * injection-safe sort (bound parameter, not interpolation), stripMeta of managed keys,
 * and the get/update/remove 404 paths. The TypeORM repository is mocked.
 */
describe('RecordsService', () => {
  let svc: RecordsService;
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    countBy: jest.Mock;
  };
  let qb: {
    where: jest.Mock;
    orderBy: jest.Mock;
    setParameter: jest.Mock;
    limit: jest.Mock;
    getMany: jest.Mock;
  };

  const rec = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    entityType: 'Invoice',
    data: { a: 1 },
    created_date: new Date(0),
    updated_date: new Date(0),
    ...over,
  });

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      delete: jest.fn(),
      countBy: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        RecordsService,
        { provide: getRepositoryToken(RecordEntity), useValue: repo },
      ],
    }).compile();
    svc = mod.get(RecordsService);
  });

  describe('list — limit cap & safe sort', () => {
    it('defaults the limit when missing / NaN / 0', async () => {
      await svc.list('Invoice');
      expect(qb.limit).toHaveBeenLastCalledWith(200);
      await svc.list('Invoice', undefined, Number.NaN);
      expect(qb.limit).toHaveBeenLastCalledWith(200);
      await svc.list('Invoice', undefined, 0);
      expect(qb.limit).toHaveBeenLastCalledWith(200);
    });

    it('clamps an over-large limit to the max', async () => {
      await svc.list('Invoice', undefined, 99999);
      expect(qb.limit).toHaveBeenLastCalledWith(500);
    });

    it('sorts a document field via a BOUND parameter (injection-safe)', async () => {
      await svc.list('Invoice', '-amount');
      expect(qb.orderBy).toHaveBeenCalledWith(
        'r.data ->> :sf',
        'DESC',
        'NULLS LAST',
      );
      expect(qb.setParameter).toHaveBeenCalledWith('sf', 'amount');
    });

    it('sorts a timestamp column directly (ascending)', async () => {
      await svc.list('Invoice', 'created_date');
      expect(qb.orderBy).toHaveBeenCalledWith('r.created_date', 'ASC');
    });
  });

  describe('get', () => {
    it('returns the merged record view', async () => {
      repo.findOne.mockResolvedValue(rec());
      await expect(svc.get('Invoice', 'r1')).resolves.toMatchObject({
        id: 'r1',
        a: 1,
      });
    });

    it('throws 404 when the id is missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.get('Invoice', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create / update — stripMeta', () => {
    it('drops managed keys (id/timestamps) from the stored document on create', async () => {
      await svc.create('Invoice', {
        a: 2,
        id: 'evil',
        created_date: 'x',
        updated_date: 'y',
      });
      expect(repo.save.mock.calls[0][0].data).toEqual({ a: 2 });
    });

    it('shallow-merges a patch (and strips managed keys); 404 when missing', async () => {
      repo.findOne.mockResolvedValueOnce(rec({ data: { a: 1, b: 1 } }));
      await svc.update('Invoice', 'r1', { b: 2, id: 'evil' });
      expect(repo.save.mock.calls[0][0].data).toEqual({ a: 1, b: 2 });

      repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.update('Invoice', 'x', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('returns {id} when a row was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });
      await expect(svc.remove('Invoice', 'r1')).resolves.toEqual({ id: 'r1' });
    });

    it('throws 404 when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(svc.remove('Invoice', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
