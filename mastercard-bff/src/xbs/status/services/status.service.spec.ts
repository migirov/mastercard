import { McConfig } from '../../../config/mc-config';
import { GatewayClient } from '../../common/gateway/gateway.client';
import { StatusService } from './status.service';

const STAGES = ['received', 'screening', 'in_network', 'settled'];
const STATUSES = ['pending', 'processing', 'completed'];

function make(): StatusService {
  const cfg = { mode: () => 'demo' } as unknown as McConfig;
  const gw = { call: jest.fn() } as unknown as GatewayClient;
  return new StatusService(cfg, gw);
}

describe('StatusService (demo progression)', () => {
  it('returns a well-formed progression whose history ends at the current status/stage', async () => {
    const r = await make().status('DEMO-TX-1');
    expect(STATUSES).toContain(r.status);
    expect(STAGES).toContain(r.stage);
    expect(r.source).toBe('demo');
    expect(r.history.length).toBeGreaterThan(0);
    const last = r.history[r.history.length - 1];
    expect(last.status).toBe(r.status);
    expect(last.stage).toBe(r.stage);
  });

  it('is stable (deterministic) for the same ref across calls', async () => {
    const svc = make();
    const a = await svc.status('STABLE-REF');
    const b = await svc.status('STABLE-REF');
    expect(b.status).toBe(a.status);
    expect(b.stage).toBe(a.stage);
  });
});
