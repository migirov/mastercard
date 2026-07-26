import React, { useState, useEffect } from 'react';
import { xbs } from '@/api/xbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { safeHttpUrl } from '@/lib/utils';
import { COUNTRIES, countryFromAccount, countryName } from '@/lib/countries';
import { AlertTriangle, FileText, Shield, TrendingUp, ArrowRight, Info, Wallet, SendHorizonal, Check, ChevronsUpDown } from 'lucide-react';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

const BOI_RATES = {
  USD: { rate: 3.618, change: -0.12 },
  EUR: { rate: 4.098, change: +0.08 },
};

function calcFxRate(invoiceCurrency, paymentCurrency) {
  if (invoiceCurrency === paymentCurrency) return 1;
  if (invoiceCurrency !== 'ILS' && paymentCurrency === 'ILS') return BOI_RATES[invoiceCurrency]?.rate || 1;
  if (invoiceCurrency === 'ILS' && paymentCurrency !== 'ILS') return 1 / (BOI_RATES[paymentCurrency]?.rate || 1);
  const ilsPerFrom = BOI_RATES[invoiceCurrency]?.rate || 1;
  const ilsPerTo = BOI_RATES[paymentCurrency]?.rate || 1;
  return ilsPerFrom / ilsPerTo;
}

// Renders the FX quote fetched from the BFF (`xbs.quote`). In `live` mode the rate comes from
// the Mastercard sandbox via the gateway; in `demo` mode it is a synthesized indicative rate.
// The `source` badge tells the user which one they're looking at.
/**
 * Provenance-aware result badge for the beneficiary checks.
 *
 * Reuses FxPanel's vocabulary below (green = Mastercard answered, amber = local/demo) for one
 * reason: a check that Mastercard never performed must not look identical to one it did. The
 * previous badge rendered a single blue "Validated" whenever the flag was truthy, so a
 * fabricated fallback answer — or a network error, which used to set the flag to true — was
 * visually indistinguishable from a genuine confirmation.
 */
/** Mirrors the BFF's DEFAULT_ADDRESS_COUNTRY — used only when the account is not an IBAN. */
const DEFAULT_COUNTRY = 'USA';

function CheckBadge({ check, source }) {
  if (!check) return null;
  const styles = {
    ok:
      source === 'live'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    error: 'bg-amber-50 text-amber-700 border-amber-200',
    // Neutral, not red: "nobody checked this" is a different statement from "this is wrong",
    // and colouring them alike would push operators to fix an address that is fine.
    unchecked: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = {
    ok: source === 'live' ? 'Validated · Mastercard' : 'Format check · Demo',
    failed: 'Not valid',
    error: 'Check unavailable',
    unchecked: 'Not checked',
  };
  return (
    <Badge className={`text-[10px] ${styles[check]}`}>
      <Shield className="w-3 h-3 mr-1" /> {labels[check]}
    </Badge>
  );
}

function FxPanel({ inv, quote }) {
  if (inv.payment_currency === inv.currency) return null;
  const loading = !quote;
  const midRate = quote?.mid_rate ?? quote?.fx_rate;
  const bankRate = quote?.fx_rate;
  const bankPayAmt = quote?.target_amount;
  const isLive = quote?.source === 'live';
  const fmt = (n) => (typeof n === 'number' ? n.toFixed(4) : '—');

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">FX Quote</span>
        </div>
        <Badge
          className={`text-[10px] ${
            isLive
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {loading ? 'Fetching…' : isLive ? 'Live · Mastercard' : 'Indicative · Demo'}
        </Badge>
      </div>
      <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-blue-100">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">1 {inv.currency}</p>
          <p className="font-bold text-sm">{currencySymbols[inv.currency]}1.00</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-2" />
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Mid rate</p>
          <p className="font-bold text-sm text-blue-700">{currencySymbols[inv.payment_currency]}{fmt(midRate)}</p>
        </div>
        <div className="ml-3 text-right">
          <p className="text-[10px] text-muted-foreground">With spread</p>
          <p className="text-xs font-semibold text-muted-foreground">{currencySymbols[inv.payment_currency]}{fmt(bankRate)}</p>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Invoice amount</span>
          <span className="font-medium">{currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>× Rate (with spread)</span>
          <span className="font-medium">{fmt(bankRate)}</span>
        </div>
        <div className="border-t border-blue-200 pt-1 flex justify-between font-semibold text-blue-700">
          <span>You pay</span>
          <span>
            {bankPayAmt != null
              ? `${currencySymbols[inv.payment_currency]}${bankPayAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>
      </div>
      <div className="flex items-start gap-1.5 pt-1 border-t border-blue-200">
        <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-blue-500 leading-relaxed">
          {isLive
            ? 'Live indicative rate from the Mastercard sandbox. The final rate is fixed at payment time.'
            : 'Indicative demo rate. Live Mastercard rates apply once enabled.'}
        </p>
      </div>
    </div>
  );
}

function InvoiceCard({ inv, index, total, onUpdate, profile }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState({ iban: false, address: false });

  /**
   * Country the address check runs against. Seeded from the IBAN prefix, which carries the
   * account's ISO-3166 alpha-2 and is therefore a good guess -- but only a guess, so it is
   * shown in an editable control. Deriving it silently was the original defect: the API
   * substituted USA for everyone and reported an Israeli address as invalid.
   */
  const [addressCountry, setAddressCountry] = useState(
    () => countryFromAccount(inv.beneficiary_account) || DEFAULT_COUNTRY,
  );

  // Follow the IBAN while the operator edits it, but never overwrite a country they picked
  // by hand -- that choice is the whole point of the control.
  const [countryTouched, setCountryTouched] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  useEffect(() => {
    if (countryTouched) return;
    const guess = countryFromAccount(inv.beneficiary_account);
    if (guess) setAddressCountry(guess);
  }, [inv.beneficiary_account, countryTouched]);

  /** Apply an operator-chosen country and drop the now-stale verdict. */
  const pickCountry = (alpha3) => {
    setCountryTouched(true);
    setAddressCountry(alpha3);
    setCountryOpen(false);
    // The previous result answered a different question ("is this a valid address in X?"),
    // so leaving the badge up would attach an old verdict to a new country.
    patch({ address_validated: false, address_source: null, address_check: null });
  };

  // Functional update (like the async quote/validation handlers) so a synchronous field edit
  // never clobbers an in-flight quote/validation result that resolved a moment earlier.
  const updateField = (field, value) => {
    onUpdate((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Fetch a real FX quote from the BFF whenever the currency pair / amount changes. Functional
  // state updates so concurrent per-invoice quotes don't clobber each other.
  useEffect(() => {
    let cancelled = false;
    if (!inv.payment_currency || inv.payment_currency === inv.currency || !inv.amount) {
      setQuote(null);
      return;
    }
    xbs
      .quote({
        source_currency: inv.currency,
        target_currency: inv.payment_currency,
        amount: inv.amount,
      })
      .then((q) => {
        if (cancelled || !q) return;
        setQuote(q);
        onUpdate((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            fx_rate: q.fx_rate,
            payment_amount:
              typeof q.target_amount === 'number'
                ? Number(q.target_amount.toFixed(2))
                : next[index].payment_amount,
          };
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
     
  }, [inv.currency, inv.payment_currency, inv.amount]);

  /** Merge a partial update into the invoice at `index`. */
  const patch = (fields) =>
    onUpdate((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...fields };
      return next;
    });

  const validateIban = async () => {
    setBusy((b) => ({ ...b, iban: true }));
    try {
      const r = await xbs.validateAccount({ iban: inv.beneficiary_account });
      // `r?.valid === true`, not `!== false`: a malformed or empty response is NOT a pass.
      patch({
        iban_validated: r?.valid === true,
        iban_source: r?.source ?? null,
        iban_check: r?.valid === true ? 'ok' : 'failed',
      });
    } catch {
      // Was `iban_validated: true` — a failed request rendered a "Validated" shield. A check
      // that did not happen is not a check that passed.
      patch({ iban_validated: false, iban_source: null, iban_check: 'error' });
    } finally {
      setBusy((b) => ({ ...b, iban: false }));
    }
  };

  const validateAddress = async () => {
    setBusy((b) => ({ ...b, address: true }));
    try {
      // Send the country explicitly. Mastercard checks the address against that country's
      // rules, and the API falls back to USA when none is given -- which quietly graded a Tel
      // Aviv address as an American one and returned a confident "invalid".
      const r = await xbs.validateAddress({
        address: inv.beneficiary_address,
        country: addressCountry,
      });
      patch({
        address_validated: r?.valid === true,
        address_source: r?.source ?? null,
        // `checked: false` means no check ran at all -- distinct from one that ran and
        // failed. Only the address response carries this; the IBAN path has an offline
        // checksum and always reaches a verdict, so it falls through to ok/failed.
        address_check:
          r?.checked === false ? 'unchecked' : r?.valid === true ? 'ok' : 'failed',
      });
    } catch {
      patch({
        address_validated: false,
        address_source: null,
        address_check: 'error',
      });
    } finally {
      setBusy((b) => ({ ...b, address: false }));
    }
  };

  const accounts = [
    { code: 'ILS', symbol: '₪', flag: '🇮🇱', balance: profile?.balance_ils || 0 },
    { code: 'USD', symbol: '$', flag: '🇺🇸', balance: profile?.balance_usd || 0 },
    { code: 'EUR', symbol: '€', flag: '🇪🇺', balance: profile?.balance_eur || 0 },
  ];

  return (
    <Card className="p-5 space-y-4 border-border">
      {/* Invoice header */}
      <div className="flex items-center justify-between">
        <div>
          {total > 1 && <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Invoice {index + 1} of {total}</p>}
          <p className="text-xs text-muted-foreground">#{inv.invoice_number}</p>
          <p className="font-bold text-base">{inv.supplier_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="font-bold text-lg">{currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}</p>
        </div>
      </div>

      {/* Document */}
      {safeHttpUrl(inv.file_url) && (
        <a href={safeHttpUrl(inv.file_url)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">View Invoice Document</span>
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
        </a>
      )}

      {/* Payment fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Payment Amount</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
              {currencySymbols[inv.payment_currency] || ''}
            </span>
            <Input
              type="text"
              value={inv.payment_amount ? inv.payment_amount.toLocaleString() : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                const num = parseFloat(raw);
                if (!isNaN(num)) updateField('payment_amount', num);
                else if (e.target.value === '') updateField('payment_amount', null);
              }}
              className="pl-7"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1"><Wallet className="w-3 h-3" /> Payment Currency</Label>
          <Select
            value={inv.payment_currency}
            onValueChange={(val) => {
              const newRate = calcFxRate(inv.currency, val);
              const newAmt = val === inv.currency ? inv.amount : inv.amount * newRate;
              // Guard against a missing/NaN amount → don't write NaN into payment_amount.
              const payAmt = Number.isFinite(newAmt)
                ? parseFloat(newAmt.toFixed(2))
                : null;
              onUpdate((prev) => {
                const next = [...prev];
                next[index] = { ...next[index], payment_currency: val, fx_rate: newRate, payment_amount: payAmt };
                return next;
              });
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(acc => (
                <SelectItem key={acc.code} value={acc.code}>
                  {acc.flag} {acc.code} — {acc.symbol}{acc.balance.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FxPanel inv={inv} quote={quote} />

      {/* Beneficiary details */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beneficiary Details</p>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">IBAN / Account Number</Label>
            <CheckBadge check={inv.iban_check} source={inv.iban_source} />
          </div>
          <div className="flex gap-2 mt-1">
            <Input
              value={inv.beneficiary_account}
              onChange={(e) => updateField('beneficiary_account', e.target.value)}
              placeholder="Enter IBAN..."
              className={`flex-1 ${!inv.beneficiary_account ? 'border-orange-300 bg-orange-50/50' : ''}`}
            />
            {!inv.iban_validated && inv.beneficiary_account && (
              <Button size="sm" variant="outline" onClick={validateIban} disabled={busy.iban} className="text-xs shrink-0">{busy.iban ? 'Validating…' : 'Validate'}</Button>
            )}
          </div>
          {!inv.beneficiary_account && (
            <p className="text-[11px] text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Required field</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Beneficiary Address</Label>
            <CheckBadge check={inv.address_check} source={inv.address_source} />
          </div>
          <div className="flex gap-2 mt-1">
            <Input
              value={inv.beneficiary_address}
              onChange={(e) => updateField('beneficiary_address', e.target.value)}
              placeholder="Enter address..."
              className={`flex-1 ${!inv.beneficiary_address ? 'border-orange-300 bg-orange-50/50' : ''}`}
            />
            {!inv.address_validated && inv.beneficiary_address && (
              <Button size="sm" variant="outline" onClick={validateAddress} disabled={busy.address} className="text-xs shrink-0">{busy.address ? 'Validating…' : 'Validate'}</Button>
            )}
          </div>
          {/* Visible and editable on purpose: Mastercard grades the address against this
              country, so the operator has to be able to see and correct what it was.
              Searchable rather than a plain list — 249 entries is not something to scroll. */}
          <div className="flex items-center gap-2 mt-2">
            <Label className="text-[11px] text-muted-foreground shrink-0">Address country</Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className="h-8 w-[240px] justify-between text-xs font-normal"
                >
                  {countryName(addressCountry)} ({addressCountry})
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country…" className="h-9 text-xs" />
                  <CommandList>
                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                      No country found.
                    </CommandEmpty>
                    <CommandGroup>
                      {COUNTRIES.map((c) => (
                        <CommandItem
                          key={c.alpha3}
                          // Searchable by name, by the alpha-3 Mastercard wants, and by the
                          // alpha-2 an operator reads off the front of the IBAN.
                          value={`${c.name} ${c.alpha3} ${c.alpha2}`}
                          onSelect={() => pickCountry(c.alpha3)}
                          className="text-xs"
                        >
                          <Check
                            className={`mr-2 h-3 w-3 ${c.alpha3 === addressCountry ? 'opacity-100' : 'opacity-0'}`}
                          />
                          {c.name}
                          <span className="ml-1 text-muted-foreground">({c.alpha3})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {!inv.beneficiary_address && (
            <p className="text-[11px] text-orange-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Required field</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function InvoiceReviewStep({ invoices, onUpdate, onProceed, profile }) {
  const [notesToApprover, setNotesToApprover] = useState('');
  const allReviewed = invoices.every(i => i.beneficiary_account?.trim() && i.beneficiary_address?.trim());

  return (
    <div className="space-y-4">
      {invoices.map((inv, index) => (
        <InvoiceCard
          key={inv.id || index}
          inv={inv}
          index={index}
          total={invoices.length}
          onUpdate={onUpdate}
          profile={profile}
        />
      ))}

      {/* Notes to approver */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Notes to Approver <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea
          value={notesToApprover}
          onChange={e => setNotesToApprover(e.target.value)}
          placeholder="Add any notes or context for the approver..."
          rows={3}
          className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <Button
        onClick={() => onProceed(notesToApprover)}
        disabled={!allReviewed}
        className="w-full bg-primary hover:bg-primary/90 font-semibold"
      >
        <SendHorizonal className="w-4 h-4 mr-2" />
        Send for Approval
      </Button>
    </div>
  );
}