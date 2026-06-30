import React, { useState } from 'react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings2, Save, CreditCard, ChevronDown, ChevronUp,
  ShoppingBag, Globe, Clock, Banknote, X
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MCC_CATEGORIES = [
  { id: 'restaurants', label: '🍽 Restaurants' },
  { id: 'supermarkets', label: '🛒 Supermarkets' },
  { id: 'fuel', label: '⛽ Fuel' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'software', label: '💻 Software' },
  { id: 'hardware', label: '🖥 Hardware' },
  { id: 'entertainment', label: '🎬 Entertainment' },
  { id: 'health', label: '🏥 Health' },
  { id: 'education', label: '📚 Education' },
  { id: 'hotels', label: '🏨 Hotels' },
  { id: 'ecommerce', label: '🛍 E-Commerce' },
  { id: 'utilities', label: '💡 Utilities' },
  { id: 'government', label: '🏛 Government' },
  { id: 'gambling', label: '🎰 Gambling' },
  { id: 'alcohol', label: '🍷 Alcohol & Bars' },
  { id: 'other', label: '📦 Other' },
];

const COUNTRIES = [
  { code: 'IL', label: '🇮🇱 Israel' },
  { code: 'US', label: '🇺🇸 USA' },
  { code: 'GB', label: '🇬🇧 UK' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'ES', label: '🇪🇸 Spain' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'PL', label: '🇵🇱 Poland' },
  { code: 'AE', label: '🇦🇪 UAE' },
  { code: 'CN', label: '🇨🇳 China' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'RU', label: '🇷🇺 Russia' },
  { code: 'UA', label: '🇺🇦 Ukraine' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'BR', label: '🇧🇷 Brazil' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function LimitField({ label, value, onChange, placeholder = '0 = no limit' }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₪</span>
        <Input
          type="number" min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 text-sm pl-6"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function CountField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</label>
      <Input type="number" min="0" value={value} onChange={e => onChange(e.target.value)}
        className="h-8 text-sm" placeholder="0 = no limit" />
    </div>
  );
}

function Toggle({ label, checked, onChange, description }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-8 h-4.5 rounded-full flex items-center transition-colors shrink-0 cursor-pointer ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        style={{ minWidth: '2rem', height: '1.1rem' }}
      >
        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <p className="text-xs font-medium leading-tight">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function TagToggle({ items, selected, onToggle, colorClass = 'bg-primary text-white border-primary' }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {items.map(item => {
        const id = item.id || item.code || item;
        const label = item.label || item;
        const active = selected.includes(id);
        return (
          <button key={id} onClick={() => onToggle(id)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${active ? colorClass : 'border-border text-muted-foreground hover:border-primary/40'}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MerchantListEditor({ label, values, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) { onChange([...values, v]); }
    setInput('');
  };
  return (
    <div>
      <label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</label>
      <div className="flex gap-1.5 mb-1.5">
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="h-7 text-xs" placeholder={placeholder} />
        <Button size="sm" variant="outline" onClick={add} className="h-7 px-2 shrink-0">Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="text-muted-foreground hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

function CardLimitEditor({ card, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState({ spending: true, merchant: false, geo: false, time: false });

  // Spending limits
  const sl = card.spending_limits || {};
  const [perTx, setPerTx] = useState(sl.per_transaction || '');
  const [daily, setDaily] = useState(sl.daily || '');
  const [weekly, setWeekly] = useState(sl.weekly || '');
  const [monthly, setMonthly] = useState(sl.monthly || card.monthly_limit || '');
  const [lifetime, setLifetime] = useState(sl.total_card_lifetime || '');
  const [maxTxDay, setMaxTxDay] = useState(sl.max_transactions_per_day || '');
  const [maxTxMonth, setMaxTxMonth] = useState(sl.max_transactions_per_month || '');

  // Merchant controls
  const mc = card.merchant_controls || {};
  const [allowedCats, setAllowedCats] = useState(mc.allowed_categories || card.allowed_categories || []);
  const [blockedCats, setBlockedCats] = useState(mc.blocked_categories || card.blocked_categories || []);
  const [allowedMerchants, setAllowedMerchants] = useState(mc.allowed_merchants || []);
  const [blockedMerchants, setBlockedMerchants] = useState(mc.blocked_merchants || []);
  const [online, setOnline] = useState(mc.online_transactions !== false);
  const [contactless, setContactless] = useState(mc.contactless !== false);
  const [atm, setAtm] = useState(mc.atm_withdrawals === true);
  const [recurring, setRecurring] = useState(mc.recurring_payments !== false);

  // Geo controls
  const gc = card.geo_controls || {};
  const [domesticOnly, setDomesticOnly] = useState(gc.domestic_only === true);
  const [allowedCountries, setAllowedCountries] = useState(gc.allowed_countries || []);
  const [blockedCountries, setBlockedCountries] = useState(gc.blocked_countries || []);

  // Time controls
  const tc = card.time_controls || {};
  const [allowedDays, setAllowedDays] = useState(tc.allowed_days || DAYS);
  const [hoursStart, setHoursStart] = useState(tc.allowed_hours_start || '');
  const [hoursEnd, setHoursEnd] = useState(tc.allowed_hours_end || '');
  const [activeFrom, setActiveFrom] = useState(tc.active_from || '');
  const [activeUntil, setActiveUntil] = useState(tc.active_until || '');

  const toggleSection = (s) => setSections(prev => ({ ...prev, [s]: !prev[s] }));
  const toggleDay = (d) => setAllowedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleAllowedCat = (c) => setAllowedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleBlockedCat = (c) => setBlockedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleAllowedCountry = (c) => setAllowedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleBlockedCountry = (c) => setBlockedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const save = async () => {
    setSaving(true);
    try {
    await api.entities.VirtualCard.update(card.id, {
      spending_limits: {
        per_transaction: parseFloat(perTx) || 0,
        daily: parseFloat(daily) || 0,
        weekly: parseFloat(weekly) || 0,
        monthly: parseFloat(monthly) || 0,
        total_card_lifetime: parseFloat(lifetime) || 0,
        max_transactions_per_day: parseInt(maxTxDay) || 0,
        max_transactions_per_month: parseInt(maxTxMonth) || 0,
      },
      merchant_controls: {
        allowed_categories: allowedCats,
        blocked_categories: blockedCats,
        allowed_merchants: allowedMerchants,
        blocked_merchants: blockedMerchants,
        online_transactions: online,
        contactless,
        atm_withdrawals: atm,
        recurring_payments: recurring,
      },
      geo_controls: {
        domestic_only: domesticOnly,
        allowed_countries: allowedCountries,
        blocked_countries: blockedCountries,
      },
      time_controls: {
        allowed_days: allowedDays,
        allowed_hours_start: hoursStart,
        allowed_hours_end: hoursEnd,
        active_from: activeFrom,
        active_until: activeUntil,
      },
      monthly_limit: parseFloat(monthly) || 0,
      single_transaction_limit: parseFloat(perTx) || 0,
      allowed_categories: allowedCats,
      blocked_categories: blockedCats,
    });
      setEditing(false);
      onRefresh();
    } catch {
      /* ignore in the demo */
    } finally {
      setSaving(false);
    }
  };

  if (card.status === 'cancelled') return null;

  // Summary pills for read view
  const summaryItems = [
    sl.per_transaction && `₪${Number(sl.per_transaction).toLocaleString()}/tx`,
    sl.daily && `₪${Number(sl.daily).toLocaleString()}/day`,
    sl.weekly && `₪${Number(sl.weekly).toLocaleString()}/wk`,
    (sl.monthly || card.monthly_limit) && `₪${Number(sl.monthly || card.monthly_limit).toLocaleString()}/mo`,
    gc.domestic_only && '🇮🇱 IL only',
    !mc.online_transactions && 'No online',
    !mc.atm_withdrawals && 'No ATM',
    allowedCats.length > 0 && `${allowedCats.length} cat`,
    blockedCats.length > 0 && `${blockedCats.length} blocked`,
    allowedCountries.length > 0 && `${allowedCountries.length} countries`,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{card.card_name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{card.employee_name} · {card.purpose} · ···{card.last4}</p>
          </div>
        </div>
        <button onClick={() => setEditing(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${editing ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
          {editing ? 'Cancel' : '✏ Edit Rules'}
        </button>
      </div>

      {/* Read-only summary */}
      {!editing && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50">
          {summaryItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {summaryItems.map((item, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded-full border border-border font-medium">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">No spending rules configured — unlimited use</p>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-border/50 divide-y divide-border/40">

          {/* ── Spending Limits ── */}
          <div className="p-3 space-y-3">
            <SectionHeader icon={Banknote} title="Spending Limits" open={sections.spending} onToggle={() => toggleSection('spending')} />
            {sections.spending && (
              <div className="grid grid-cols-2 gap-2.5 px-1">
                <LimitField label="Per Transaction" value={perTx} onChange={setPerTx} />
                <LimitField label="Daily" value={daily} onChange={setDaily} />
                <LimitField label="Weekly" value={weekly} onChange={setWeekly} />
                <LimitField label="Monthly" value={monthly} onChange={setMonthly} />
                <LimitField label="Card Lifetime Total" value={lifetime} onChange={setLifetime} />
                <div />
                <CountField label="Max transactions / day" value={maxTxDay} onChange={setMaxTxDay} />
                <CountField label="Max transactions / month" value={maxTxMonth} onChange={setMaxTxMonth} />
              </div>
            )}
          </div>

          {/* ── Merchant Controls ── */}
          <div className="p-3 space-y-3">
            <SectionHeader icon={ShoppingBag} title="Merchant & Category Controls" open={sections.merchant} onToggle={() => toggleSection('merchant')} />
            {sections.merchant && (
              <div className="space-y-4 px-1">
                <div>
                  <p className="text-xs font-semibold mb-1 text-emerald-700">✅ Allowed categories <span className="font-normal text-muted-foreground">(empty = all)</span></p>
                  <TagToggle items={MCC_CATEGORIES} selected={allowedCats} onToggle={toggleAllowedCat}
                    colorClass="bg-emerald-600 text-white border-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1 text-red-600">🚫 Blocked categories</p>
                  <TagToggle items={MCC_CATEGORIES} selected={blockedCats} onToggle={toggleBlockedCat}
                    colorClass="bg-red-600 text-white border-red-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MerchantListEditor label="✅ Allowed merchants" values={allowedMerchants} onChange={setAllowedMerchants} placeholder="e.g. Amazon" />
                  <MerchantListEditor label="🚫 Blocked merchants" values={blockedMerchants} onChange={setBlockedMerchants} placeholder="e.g. Casino" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Toggle label="Online / CNP transactions" checked={online} onChange={setOnline} description="Card-not-present, e-commerce" />
                  <Toggle label="Contactless / NFC" checked={contactless} onChange={setContactless} description="Tap to pay" />
                  <Toggle label="ATM cash withdrawals" checked={atm} onChange={setAtm} description="Physical ATM only" />
                  <Toggle label="Recurring payments" checked={recurring} onChange={setRecurring} description="Subscriptions & auto-charges" />
                </div>
              </div>
            )}
          </div>

          {/* ── Geo Controls ── */}
          <div className="p-3 space-y-3">
            <SectionHeader icon={Globe} title="Geographic / Territory Rules" open={sections.geo} onToggle={() => toggleSection('geo')} />
            {sections.geo && (
              <div className="space-y-4 px-1">
                <Toggle label="Israel only (domestic)" checked={domesticOnly} onChange={setDomesticOnly} description="Block all international transactions" />
                {!domesticOnly && (
                  <>
                    <div>
                      <p className="text-xs font-semibold mb-1 text-emerald-700">✅ Allowed countries <span className="font-normal text-muted-foreground">(empty = all)</span></p>
                      <TagToggle items={COUNTRIES} selected={allowedCountries} onToggle={toggleAllowedCountry}
                        colorClass="bg-emerald-600 text-white border-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1 text-red-600">🚫 Blocked countries</p>
                      <TagToggle items={COUNTRIES} selected={blockedCountries} onToggle={toggleBlockedCountry}
                        colorClass="bg-red-600 text-white border-red-600" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Time Controls ── */}
          <div className="p-3 space-y-3">
            <SectionHeader icon={Clock} title="Time-Based Rules" open={sections.time} onToggle={() => toggleSection('time')} />
            {sections.time && (
              <div className="space-y-4 px-1">
                <div>
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Allowed days of week</p>
                  <div className="flex gap-1.5">
                    {DAYS.map(d => (
                      <button key={d} onClick={() => toggleDay(d)}
                        className={`text-[11px] px-2 py-1 rounded-md border font-semibold transition-colors ${allowedDays.includes(d) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Active hours — from</label>
                    <Input type="time" value={hoursStart} onChange={e => setHoursStart(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Active hours — until</label>
                    <Input type="time" value={hoursEnd} onChange={e => setHoursEnd(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Active from date</label>
                    <Input type="date" value={activeFrom} onChange={e => setActiveFrom(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Active until date</label>
                    <Input type="date" value={activeUntil} onChange={e => setActiveUntil(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="p-3">
            <Button className="w-full gap-2" onClick={save} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving rules...' : 'Save All Rules'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CardSettings({ cards, selectedEmployee, onRefresh }) {
  const filtered = selectedEmployee
    ? cards.filter(c => c.employee_id === selectedEmployee.id && c.status !== 'cancelled')
    : cards.filter(c => c.status !== 'cancelled');

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Settings2 className="w-8 h-8 opacity-30" />
        <p className="text-sm">No active cards to configure</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Configure spending rules, merchant restrictions, geographic limits and time controls per card — similar to Ramp, Brex & Mesh policies.
      </p>
      {filtered.map(card => (
        <CardLimitEditor key={card.id} card={card} onRefresh={onRefresh} />
      ))}
    </div>
  );
}