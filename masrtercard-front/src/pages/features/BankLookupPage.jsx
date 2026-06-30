import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
} from '@/components/features/FeatureShell';

// Mastercard Bank Information Lookup — returns REAL sandbox data (live by default).
export default function BankLookupPage() {
  const [form, setForm] = useState({
    name: '*of Africa United Kingdom*SUC20004',
    country: 'GBR',
    bic: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await features.bankLookup({
        name: form.name,
        country: form.country,
        bic: form.bic || undefined,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'Lookup failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={Landmark}
      title="Bank Lookup"
      subtitle="Find a bank's BIC/SWIFT and branch details by name + country (Mastercard Bank Information Lookup)."
      source={result?.source}
    >
      <FeatureCard title="Search">
        <form onSubmit={submit} className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">
              Bank name <span className="text-muted-foreground">(use * wildcards)</span>
            </Label>
            <Input className="mt-1" value={form.name} onChange={set('name')} placeholder="*national bank*" />
          </div>
          <div>
            <Label className="text-xs">Country (ISO-3)</Label>
            <Input className="mt-1" value={form.country} onChange={set('country')} placeholder="GBR" />
          </div>
          <div>
            <Label className="text-xs">BIC (optional)</Label>
            <Input className="mt-1" value={form.bic} onChange={set('bic')} placeholder="NWBKGB2L" />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={loading || !form.name || !form.country}>
              {loading ? 'Searching…' : 'Search banks'}
            </Button>
          </div>
        </form>
      </FeatureCard>

      <FeatureCard title={result ? `Results (${result.total ?? result.banks?.length ?? 0})` : 'Results'}>
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result || !(result.banks || []).length}
          emptyHint="Search a bank to see matches."
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Bank' },
              { key: 'bic', label: 'BIC' },
              { key: 'branch', label: 'Branch' },
              { key: 'country', label: 'Country' },
              { key: 'address', label: 'Address' },
            ]}
            rows={result?.banks || []}
          />
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
