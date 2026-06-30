import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Globe, CreditCard, Hash, ChevronDown, ChevronUp, X, Plus
} from 'lucide-react';

const CURRENCIES = ['ILS', 'USD', 'EUR'];
const PAYMENT_TYPES = ['SWIFT', 'SEPA', 'ACH', 'Local', 'MASAV'];
const COUNTRIES = [
  { code: 'US', name: 'USA' }, { code: 'GB', name: 'UK' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'IL', name: 'Israel' }, { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Russia' }, { code: 'IR', name: 'Iran' }, { code: 'KP', name: 'N. Korea' },
  { code: 'SY', name: 'Syria' }, { code: 'CU', name: 'Cuba' }, { code: 'VE', name: 'Venezuela' },
];

const CURRENCY_LIMIT_KEYS = {
  ILS: { single: 'max_single_payment_ils', daily: 'max_daily_ils', monthly: 'max_monthly_ils' },
  USD: { single: 'max_single_payment_usd', daily: 'max_daily_usd', monthly: 'max_monthly_usd' },
  EUR: { single: 'max_single_payment_eur', daily: 'max_daily_eur', monthly: 'max_monthly_eur' },
};

const LIMIT_SECTIONS = [
  {
    id: 'amount',
    icon: DollarSign,
    label: 'Amount Limits',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    type: 'per_currency',
  },
  {
    id: 'currency',
    icon: CreditCard,
    label: 'Currency Restrictions',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    type: 'multi_select',
    key: 'allowed_currencies',
    options: CURRENCIES,
    hint: 'Empty = all currencies allowed'
  },
  {
    id: 'territory',
    icon: Globe,
    label: 'Territory (Countries)',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    type: 'territory',
  },
  {
    id: 'payment_types',
    icon: CreditCard,
    label: 'Payment Types',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    type: 'multi_select',
    key: 'allowed_payment_types',
    options: PAYMENT_TYPES,
    hint: 'Empty = all types allowed'
  },
  {
    id: 'batch',
    icon: Hash,
    label: 'Batch & Approval',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    fields: [
      { key: 'max_invoices_per_batch', label: 'Max invoices per batch', placeholder: '0 = no limit', type: 'number' },
    ],
    toggle: { key: 'requires_dual_approval', label: 'Always require dual approval' }
  },
];

function TagInput({ values = [], options, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = (val) => {
    if (val && !values.includes(val)) onChange([...values, val]);
    setInput('');
  };
  const remove = (val) => onChange(values.filter(v => v !== val));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {v}
            <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => remove(v)} />
          </span>
        ))}
      </div>
      {options ? (
        <div className="flex flex-wrap gap-1">
          {options.filter(o => !values.includes(o)).map(o => (
            <button key={o} onClick={() => add(o)}
              className="text-[11px] border border-dashed border-muted-foreground/40 text-muted-foreground px-2 py-0.5 rounded-full hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
              <Plus className="w-2.5 h-2.5" />{o}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add(input)} placeholder={placeholder} className="h-7 text-xs" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => add(input)}>Add</Button>
        </div>
      )}
    </div>
  );
}

export default function UserLimitsForm({ limits = {}, onChange }) {
  const [expanded, setExpanded] = useState({});

  const update = (key, value) => onChange({ ...limits, [key]: value });

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authorization Limits</p>

      {LIMIT_SECTIONS.map(section => {
        const Icon = section.icon;
        const isOpen = expanded[section.id];
        const hasValues = section.type === 'per_currency'
          ? Object.values(CURRENCY_LIMIT_KEYS).some(keys => Object.values(keys).some(k => limits[k] > 0))
          : section.fields
          ? section.fields.some(f => limits[f.key] > 0)
          : section.key ? (limits[section.key]?.length > 0)
          : section.id === 'territory' ? ((limits.allowed_countries?.length > 0) || (limits.blocked_countries?.length > 0))
          : section.toggle ? limits[section.toggle.key]
          : false;

        return (
          <div key={section.id} className={`rounded-lg border ${hasValues ? section.border : 'border-border'} overflow-hidden`}>
            <button
              onClick={() => toggle(section.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${hasValues ? section.bg : 'bg-muted/30 hover:bg-muted/50'}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${hasValues ? section.color : 'text-muted-foreground'}`} />
                <span className={`text-xs font-semibold ${hasValues ? section.color : 'text-foreground'}`}>{section.label}</span>
                {hasValues && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${section.bg} ${section.color} border ${section.border}`}>Active</span>}
              </div>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="p-3 space-y-3 bg-card">
                {/* Per-currency amount limits */}
                {section.type === 'per_currency' && (
                  <div className="space-y-4">
                    {Object.entries(CURRENCY_LIMIT_KEYS).map(([currency, keys]) => (
                      <div key={currency} className="rounded-lg border border-border p-3 space-y-2">
                        <p className="text-xs font-bold text-foreground">{currency}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Max / payment</Label>
                            <Input type="number" value={limits[keys.single] || ''} onChange={e => update(keys.single, Number(e.target.value))} placeholder="0 = ∞" className="h-7 mt-0.5 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Max / day</Label>
                            <Input type="number" value={limits[keys.daily] || ''} onChange={e => update(keys.daily, Number(e.target.value))} placeholder="0 = ∞" className="h-7 mt-0.5 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Max / month</Label>
                            <Input type="number" value={limits[keys.monthly] || ''} onChange={e => update(keys.monthly, Number(e.target.value))} placeholder="0 = ∞" className="h-7 mt-0.5 text-xs" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Regular amount fields */}
                {section.fields?.map(field => (
                  <div key={field.key}>
                    <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                    <Input
                      type={field.type}
                      value={limits[field.key] || ''}
                      onChange={e => update(field.key, Number(e.target.value))}
                      placeholder={field.placeholder}
                      className="h-8 mt-1 text-sm"
                    />
                  </div>
                ))}

                {/* Toggle */}
                {section.toggle && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{section.toggle.label}</Label>
                    <button
                      onClick={() => update(section.toggle.key, !limits[section.toggle.key])}
                      className={`w-10 h-5 rounded-full transition-colors relative ${limits[section.toggle.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${limits[section.toggle.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}

                {/* Multi select */}
                {section.type === 'multi_select' && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">{section.hint}</p>
                    <TagInput
                      values={limits[section.key] || []}
                      options={section.options}
                      onChange={v => update(section.key, v)}
                    />
                  </div>
                )}

                {/* Territory */}
                {section.type === 'territory' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[11px] text-emerald-700 font-semibold">✓ Allowed Countries <span className="text-muted-foreground font-normal">(empty = all)</span></Label>
                      <div className="mt-1.5">
                        <TagInput
                          values={limits.allowed_countries || []}
                          options={COUNTRIES.map(c => c.code)}
                          onChange={v => update('allowed_countries', v)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-red-600 font-semibold">✕ Blocked Countries</Label>
                      <div className="mt-1.5">
                        <TagInput
                          values={limits.blocked_countries || []}
                          options={COUNTRIES.map(c => c.code)}
                          onChange={v => update('blocked_countries', v)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}