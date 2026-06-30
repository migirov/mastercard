import React, { useState } from 'react';
import { Hash } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  KeyValueList,
} from '@/components/features/FeatureShell';

// Mastercard IBAN Generation — returns REAL sandbox data (live by default).
export default function IbanPage() {
  const [form, setForm] = useState({
    country: 'FRA',
    ban: '20041010050500013M02606',
    branchCode: '2004101005',
    accountNo: '0500013026',
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
      const r = await features.iban({
        country: form.country,
        ban: form.ban || undefined,
        branchCode: form.branchCode || undefined,
        accountNo: form.accountNo || undefined,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'Generation failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={Hash}
      title="IBAN Generator"
      subtitle="Convert a domestic account number (BAN) into an IBAN with its bank details (Mastercard IBAN Generation)."
      source={result?.source}
    >
      <FeatureCard title="Account details">
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Country (ISO-3)</Label>
            <Input className="mt-1" value={form.country} onChange={set('country')} placeholder="FRA" />
          </div>
          <div>
            <Label className="text-xs">BAN <span className="text-muted-foreground">(optional)</span></Label>
            <Input className="mt-1" value={form.ban} onChange={set('ban')} placeholder="20041010050500013M02606" />
          </div>
          <div>
            <Label className="text-xs">Branch code <span className="text-muted-foreground">(optional)</span></Label>
            <Input className="mt-1" value={form.branchCode} onChange={set('branchCode')} placeholder="2004101005" />
          </div>
          <div>
            <Label className="text-xs">Account no. <span className="text-muted-foreground">(optional)</span></Label>
            <Input className="mt-1" value={form.accountNo} onChange={set('accountNo')} placeholder="0500013026" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading || !form.country}>
              {loading ? 'Generating…' : 'Generate IBAN'}
            </Button>
          </div>
        </form>
      </FeatureCard>

      <FeatureCard title="Generated IBAN">
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result}
          emptyHint="Generate an IBAN to see the result."
        >
          <KeyValueList
            entries={[
              ['IBAN', result?.iban],
              ['BAN', result?.ban],
              ['BIC', result?.bank?.bic],
              ['Bank', result?.bank?.name],
              ['Branch code', result?.bank?.branchCode],
              ['Address', result?.bank?.address],
            ]}
          />
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
