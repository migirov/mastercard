import React, { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
  KeyValueList,
} from '@/components/features/FeatureShell';

// Endpoint Guide — DEMO by default: the Mastercard sandbox returns 502 for the generic
// partner-id, so the BFF synthesizes a corridor spec (shown with a Demo badge).
export default function EndpointGuidePage() {
  const [form, setForm] = useState({
    payment_type: 'B2B',
    destination_country: 'PHL',
    destination_currency: 'PHP',
    destination_payment_instrument: 'BANK',
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
      const r = await features.endpointGuide({
        payment_type: form.payment_type,
        destination_country: form.destination_country,
        destination_currency: form.destination_currency,
        destination_payment_instrument: form.destination_payment_instrument,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'Lookup failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const corridor = result?.corridor;
  const limits = result?.limits;

  return (
    <FeatureShell
      icon={BookMarked}
      title="Endpoint Guide"
      subtitle="Look up the required fields and limits for a cross-border corridor (payment type, destination, instrument)."
      source={result?.source}
    >
      <FeatureCard title="Corridor query">
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Payment type</Label>
            <Input
              className="mt-1"
              value={form.payment_type}
              onChange={set('payment_type')}
              placeholder="B2B"
            />
          </div>
          <div>
            <Label className="text-xs">Destination country (ISO-3)</Label>
            <Input
              className="mt-1"
              value={form.destination_country}
              onChange={set('destination_country')}
              placeholder="PHL"
            />
          </div>
          <div>
            <Label className="text-xs">Destination currency</Label>
            <Input
              className="mt-1"
              value={form.destination_currency}
              onChange={set('destination_currency')}
              placeholder="PHP"
            />
          </div>
          <div>
            <Label className="text-xs">Destination instrument</Label>
            <Input
              className="mt-1"
              value={form.destination_payment_instrument}
              onChange={set('destination_payment_instrument')}
              placeholder="BANK"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Loading…' : 'Get corridor requirements'}
            </Button>
          </div>
        </form>
      </FeatureCard>

      <FeatureCard title="Corridor">
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result}
          emptyHint="Submit the form to see corridor requirements."
        >
          {corridor && (
            <KeyValueList
              entries={[
                ['Payment type', corridor.payment_type],
                [
                  'Destination',
                  `${corridor.destination_country} · ${corridor.destination_currency}`,
                ],
                ['Instrument', corridor.destination_payment_instrument],
                ['Min', limits && `${limits.min} ${limits.currency}`],
                ['Max', limits && `${limits.max} ${limits.currency}`],
              ]}
            />
          )}
        </ResultPanel>
      </FeatureCard>

      <FeatureCard title="Required fields">
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result}
          emptyHint="Submit the form to see required fields."
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Field' },
              {
                key: 'required',
                label: 'Required',
                render: (r) => (
                  <Badge
                    className={
                      r.required
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {r.required ? 'Required' : 'Optional'}
                  </Badge>
                ),
              },
              { key: 'description', label: 'Description' },
            ]}
            rows={result?.fields || []}
          />
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
