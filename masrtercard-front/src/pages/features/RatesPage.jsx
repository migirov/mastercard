import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
} from '@/components/features/FeatureShell';

// FX / Carded Rates — DEMO by default (the sandbox returns no carded-rate data, so the BFF
// synthesizes a rate board). Loads the full board on mount; base/quote are optional filters.
export default function RatesPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [base, setBase] = useState('');
  const [quote, setQuote] = useState('');

  const load = async (params) => {
    setLoading(true);
    setError(null);
    try {
      const r = await features.rates(params);
      setResult(r);
    } catch (err) {
      setError(err.message || 'Failed to load rates');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({});
     
  }, []);

  const refresh = (e) => {
    e?.preventDefault();
    load({ base: base || undefined, quote: quote || undefined });
  };

  return (
    <FeatureShell
      icon={TrendingUp}
      title="FX / Carded Rates"
      subtitle="Indicative cross-border FX rate board. Filter by base/quote currency or view the full board."
      source={result?.source}
    >
      <FeatureCard title="Filter">
        <form onSubmit={refresh} className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">
              Base <span className="text-muted-foreground">(ISO-3, optional)</span>
            </Label>
            <Input
              className="mt-1"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="USD"
            />
          </div>
          <div>
            <Label className="text-xs">
              Quote <span className="text-muted-foreground">(ISO-3, optional)</span>
            </Label>
            <Input
              className="mt-1"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="ILS"
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </form>
      </FeatureCard>

      <FeatureCard title="Rate board">
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result || !(result.rates || []).length}
          emptyHint="No rates to show."
        >
          <DataTable
            columns={[
              { key: 'pair', label: 'Pair' },
              {
                key: 'rate',
                label: 'Rate',
                render: (r) =>
                  typeof r.rate === 'number' ? r.rate.toFixed(4) : r.rate,
              },
              {
                key: 'change',
                label: '24h',
                render: (r) =>
                  r.change == null
                    ? '—'
                    : `${r.change > 0 ? '+' : ''}${(r.change * 100).toFixed(2)}%`,
              },
            ]}
            rows={result?.rates || []}
          />
          {result?.asOf && (
            <p className="mt-2 text-xs text-muted-foreground">
              As of {new Date(result.asOf).toLocaleString()}
            </p>
          )}
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
