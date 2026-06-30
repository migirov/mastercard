import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { features } from '@/api/features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import FeatureShell, {
  FeatureCard,
  ResultPanel,
  DataTable,
} from '@/components/features/FeatureShell';

// Mastercard Cash Pickup Locations — browses four LIVE sandbox catalogs:
// countries, cities, providers, branches.

// Per-catalog config: default params, the inputs to show, and the result columns.
const CATALOGS = {
  countries: {
    label: 'Countries',
    defaults: { cash_pickup_type: 'PANY' },
    fields: [{ key: 'cash_pickup_type', label: 'Cash pickup type', placeholder: 'PANY' }],
    columns: [
      { key: 'countryAlpha3', label: 'Country' },
      { key: 'currency', label: 'Currency' },
      { key: 'cashPickupType', label: 'Type' },
    ],
  },
  cities: {
    label: 'Cities',
    defaults: { country: 'GTM', currency: 'GTQ', limit: '10' },
    fields: [
      { key: 'country', label: 'Country (ISO-3)', placeholder: 'GTM' },
      { key: 'currency', label: 'Currency', placeholder: 'GTQ' },
      { key: 'limit', label: 'Limit', placeholder: '10' },
    ],
    columns: [
      { key: 'city', label: 'City' },
      { key: 'stateName', label: 'State' },
      { key: 'country', label: 'Country' },
      { key: 'currency', label: 'Currency' },
    ],
  },
  providers: {
    label: 'Providers',
    defaults: { country: 'ARE', currency: 'AED', cash_pickup_type: 'IN_NETWORK', limit: '5' },
    fields: [
      { key: 'country', label: 'Country (ISO-3)', placeholder: 'ARE' },
      { key: 'currency', label: 'Currency', placeholder: 'AED' },
      { key: 'cash_pickup_type', label: 'Cash pickup type', placeholder: 'IN_NETWORK' },
      { key: 'limit', label: 'Limit', placeholder: '5' },
    ],
    columns: [
      { key: 'providerName', label: 'Provider' },
      { key: 'providerId', label: 'ID' },
      { key: 'country', label: 'Country' },
      { key: 'currency', label: 'Currency' },
    ],
  },
  branches: {
    label: 'Branches',
    defaults: { provider_id: '', city: '', limit: '10' },
    fields: [
      { key: 'provider_id', label: 'Provider ID', placeholder: 'Provider ID' },
      { key: 'city', label: 'City', placeholder: 'City' },
      { key: 'limit', label: 'Limit', placeholder: '10' },
    ],
    columns: [
      { key: 'name', label: 'Branch' },
      { key: 'city', label: 'City' },
      { key: 'address', label: 'Address' },
    ],
  },
};

export default function CashPickupPage() {
  const [kind, setKind] = useState('countries');
  const [params, setParams] = useState({ ...CATALOGS.countries.defaults });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const catalog = CATALOGS[kind];

  const changeKind = (next) => {
    setKind(next);
    setParams({ ...CATALOGS[next].defaults });
    setResult(null);
    setError(null);
  };

  const set = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await features.cashPickup[kind](params);
      setResult(r);
    } catch (err) {
      setError(err.message || 'Load failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureShell
      icon={MapPin}
      title="Cash Pickup Locations"
      subtitle="Browse Mastercard cash-pickup catalogs: countries, cities, providers and branches."
      source={result?.source}
    >
      <FeatureCard title="Catalog">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Catalog</Label>
            <Select value={kind} onValueChange={changeKind}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a catalog" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATALOGS).map(([key, c]) => (
                  <SelectItem key={key} value={key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {catalog.fields.map((field) => (
            <div key={field.key}>
              <Label className="text-xs">{field.label}</Label>
              <Input
                className="mt-1"
                value={params[field.key] ?? ''}
                onChange={set(field.key)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <div className="md:col-span-3">
            <Button onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Load'}
            </Button>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard title={result ? `Results (${result.total ?? (result.items || []).length})` : 'Results'}>
        <ResultPanel
          loading={loading}
          error={error}
          empty={!result || !(result.items || []).length}
          emptyHint="Pick a catalog and press Load to see results."
        >
          <DataTable columns={catalog.columns} rows={result?.items || []} />
        </ResultPanel>
      </FeatureCard>
    </FeatureShell>
  );
}
