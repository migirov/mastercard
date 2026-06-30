import React, { useState } from 'react';
import { FileCheck } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  KeyValueList,
} from '@/components/features/FeatureShell';

// Quote Lifecycle — confirm / cancel / retrieve a quote proposal (DEMO by default).
export default function QuoteLifecyclePage() {
  const [form, setForm] = useState({
    transactionReference: '08POC342598033X',
    proposalId: 'pen-4000000044472562338287758',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (apiFn) => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await apiFn({
          transactionReference: form.transactionReference,
          proposalId: form.proposalId,
        }),
      );
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={FileCheck}
      title="Quote Lifecycle"
      subtitle="Confirm, cancel, or retrieve a quote proposal by transaction reference + proposal ID."
      source={result?.source}
    >
      <FeatureCard title="Proposal">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Transaction reference</Label>
            <Input
              className="mt-1"
              value={form.transactionReference}
              onChange={set('transactionReference')}
              placeholder="08POC342598033X"
            />
          </div>
          <div>
            <Label className="text-xs">Proposal ID</Label>
            <Input
              className="mt-1"
              value={form.proposalId}
              onChange={set('proposalId')}
              placeholder="pen-4000000044472562338287758"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button
              disabled={loading}
              onClick={() => run(features.quoteLifecycle.confirm)}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => run(features.quoteLifecycle.cancel)}
            >
              Cancel
            </Button>
            <Button
              disabled={loading}
              onClick={() => run(features.quoteLifecycle.retrieve)}
            >
              Retrieve
            </Button>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard title="Result">
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result}
          emptyHint="Confirm, cancel, or retrieve a proposal."
        >
          <KeyValueList
            entries={[
              ['State', result?.state],
              ['Transaction ref', result?.transactionReference],
              ['Proposal ID', result?.proposalId],
              ['FX rate', result?.fxRate],
              [
                'Charged',
                result?.chargedAmount &&
                  `${result.chargedAmount} ${result?.currency || ''}`,
              ],
              ['Expires', result?.expiresAt],
            ]}
          />
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
