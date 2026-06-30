import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ArrowRight, Building2, CreditCard, ArrowLeftRight, Loader2, Banknote } from 'lucide-react';
import { api } from '@/api/apiClient';
import { xbs } from '@/api/xbs';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

/** Tiny live/demo badge for the `source` flag returned by /xbs/*. */
function SourceBadge({ source }) {
  if (!source) return null;
  const live = source === 'live';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
      {live ? 'Live · Mastercard' : 'Demo'}
    </span>
  );
}

const TOP_UP_OPTIONS = [
  {
    id: 'bank_transfer',
    icon: Building2,
    label: 'Bank Transfer',
    desc: 'Wire transfer from your company bank account',
    details: {
      bankName: 'Bank Hapoalim',
      accountNumber: '12-345-678901',
      routingNumber: 'IL62010800000009999999',
      reference: 'XBS-TOPUP',
    },
  },
  {
    id: 'masav',
    icon: ArrowLeftRight,
    label: 'MASAV Transfer',
    desc: 'Direct debit via Israeli MASAV clearing',
    details: {
      bankName: 'Altshuler Shaham',
      accountNumber: '10-100-202030',
      routingNumber: 'IL42108020001200082',
      reference: 'MASAV-XBS',
    },
  },
  {
    id: 'a2a',
    icon: CreditCard,
    label: 'Account-to-Account (A2A)',
    desc: 'Instant transfer between linked accounts',
    details: null,
  },
];

function BalanceRow({ cur, required, balance }) {
  const gap = Math.max(0, required - balance);
  const sym = currencySymbols[cur];
  return (
    <div className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/40 border border-border">
      <span className="font-medium">{cur}</span>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Balance: <span className="font-semibold text-foreground">{sym}{balance.toLocaleString()}</span></span>
        <span className="text-muted-foreground">Needed: <span className="font-semibold text-foreground">{sym}{required.toLocaleString()}</span></span>
        {gap > 0 && (
          <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            -{sym}{gap.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function FundingStep({ invoices, profile, onProceed }) {
  const [checking, setChecking] = useState(true);
  const [fundingGap, setFundingGap] = useState(null);
  const [liveBalances, setLiveBalances] = useState(null); // [{currency,available}] from /xbs/balances
  const [source, setSource] = useState(null); // 'live' | 'demo'
  const [selectedOption, setSelectedOption] = useState(null);
  const [topUpState, setTopUpState] = useState('idle'); // idle | processing | success
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const required = { ILS: 0, USD: 0, EUR: 0 };
      invoices.forEach(inv => {
        const cur = inv.payment_currency || inv.currency;
        const amt = Number(inv.payment_amount) || Number(inv.amount) || 0;
        required[cur] = (required[cur] || 0) + amt;
      });

      // Sufficiency is checked against the company's funded balances (the demo profile), so the
      // flow stays predictable regardless of which currencies the real sandbox account happens
      // to hold.
      const profileBal = {
        ILS: profile?.balance_ils || 0,
        USD: profile?.balance_usd || 0,
        EUR: profile?.balance_eur || 0,
      };
      const gaps = {};
      let hasGap = false;
      Object.keys(required).forEach(cur => {
        if (required[cur] > 0 && required[cur] > profileBal[cur]) {
          gaps[cur] = required[cur] - profileBal[cur];
          hasGap = true;
        }
      });

      // The REAL Mastercard account balances (/xbs/balances) — shown for transparency with a
      // live/demo badge. `live` mode returns the actual MC sandbox holdings; demo otherwise.
      let live = null;
      let src = null;
      try {
        const res = await xbs.balances();
        src = res?.source ?? null;
        live = (res?.balances ?? []).map(b => ({
          currency: String(b.currency ?? '').toUpperCase(),
          available: Number(b.available) || 0,
        }));
      } catch {
        live = null;
      }
      if (cancelled) return;

      setLiveBalances(live);
      setSource(src);
      setFundingGap(hasGap ? { required, balances: profileBal, gaps } : null);
      setChecking(false);
    })();

    return () => { cancelled = true; };
  }, [invoices, profile]);

  const handleTopUp = () => {
    if (!selectedOption) return;
    setTopUpState('processing');
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 20 + 8;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(async () => {
          setTopUpState('success');
          // Save top-up record
          const FX = { ILS: 1, USD: 3.618, EUR: 4.098 };
          const totalIls = Object.entries(fundingGap.gaps).reduce((sum, [cur, amt]) => sum + amt * (FX[cur] || 1), 0);
          const methodLabel = TOP_UP_OPTIONS.find(o => o.id === selectedOption)?.label || selectedOption;
          const currencies = Object.entries(fundingGap.gaps).map(([currency, amount]) => ({ currency, amount }));
          try {
            const user = await api.auth.me();
            await api.entities.TopUp.create({
              account_name: user?.full_name || user?.email || 'Unknown',
              transfer_method: methodLabel,
              amount_ils: parseFloat(totalIls.toFixed(2)),
              currencies,
              date: new Date().toISOString(),
            });
          } catch {}
        }, 400);
      }
      setProgress(Math.min(p, 100));
    }, 350);
  };

  if (checking) {
    return (
      <Card className="p-8 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full mx-auto mb-4"
        />
        <p className="font-semibold">Checking account balances...</p>
        <p className="text-sm text-muted-foreground mt-1">Verifying sufficient funds for all payments</p>
      </Card>
    );
  }

  if (!fundingGap) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-bold">Sufficient account balance</p>
            <p className="text-sm text-muted-foreground">Processing payment now</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['ILS', 'USD', 'EUR'].map(cur => {
            const required = invoices.filter(i => (i.payment_currency || i.currency) === cur).reduce((s, i) => s + (i.payment_amount || i.amount || 0), 0);
            if (required === 0) return null;
            return (
              <div key={cur} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{cur} Payment</p>
                <p className="font-bold">{currencySymbols[cur]}{required.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
        {/* Real Mastercard account balances from /xbs/balances (live in `live` mode). */}
        {liveBalances && liveBalances.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Mastercard account balance <SourceBadge source={source} />
            </p>
            <div className="grid grid-cols-3 gap-2">
              {liveBalances.map(b => (
                <div key={b.currency} className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{b.currency}</p>
                  <p className="font-bold text-sm">{currencySymbols[b.currency] || ''}{b.available.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <Button onClick={onProceed} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
          Pay now <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    );
  }

  // Gap exists — show top-up flow
  return (
    <Card className="p-6 space-y-4">
      <AnimatePresence mode="wait">

        {/* IDLE — select top-up method */}
        {topUpState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-bold">Insufficient balance — top-up required</p>
                <p className="text-sm text-muted-foreground">
                  {Object.entries(fundingGap.gaps).map(([cur, amt]) =>
                    `${currencySymbols[cur]}${amt.toLocaleString()} ${cur}`
                  ).join(' · ')} missing
                </p>
              </div>
            </div>

            {/* Balance breakdown */}
            <div className="space-y-1.5">
              {Object.keys(fundingGap.required).filter(cur => fundingGap.required[cur] > 0).map(cur => (
                <BalanceRow key={cur} cur={cur} required={fundingGap.required[cur]} balance={fundingGap.balances[cur]} />
              ))}
            </div>

            {/* Top-up options */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose top-up method</p>
              {TOP_UP_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedOption === option.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedOption === option.id ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <option.icon className={`w-4 h-4 ${selectedOption === option.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-[11px] text-muted-foreground">{option.desc}</p>
                  </div>
                  {selectedOption === option.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}
            </div>

            {/* Bank details if a transfer method is selected */}
            {selectedOption && selectedOption !== 'a2a' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1.5 text-xs">
                <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5" /> Transfer details
                </p>
                {(() => {
                  const opt = TOP_UP_OPTIONS.find(o => o.id === selectedOption);
                  const FX = { ILS: 1, USD: 3.618, EUR: 4.098 };
                  const totalIls = Object.entries(fundingGap.gaps).reduce((sum, [cur, amt]) => sum + amt * (FX[cur] || 1), 0);
                  return (
                    <>
                      <div className="flex justify-between"><span className="text-blue-600">Bank</span><span className="font-medium text-blue-900">{opt.details.bankName}</span></div>
                      <div className="flex justify-between"><span className="text-blue-600">Account</span><span className="font-mono font-medium text-blue-900">{opt.details.accountNumber}</span></div>
                      <div className="flex justify-between"><span className="text-blue-600">IBAN / Routing</span><span className="font-mono font-medium text-blue-900">{opt.details.routingNumber}</span></div>
                      <div className="flex justify-between"><span className="text-blue-600">Reference</span><span className="font-mono font-medium text-blue-900">{opt.details.reference}</span></div>
                      <div className="flex justify-between border-t border-blue-200 pt-1.5 mt-1">
                        <span className="font-semibold text-blue-700">Top-up Amount (ILS)</span>
                        <span className="font-bold text-blue-900">₪{totalIls.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            <Button
              onClick={handleTopUp}
              disabled={!selectedOption}
              className="w-full bg-primary hover:bg-primary/90 font-semibold"
            >
              {selectedOption === 'a2a' ? 'Initiate A2A Transfer' : 'Confirm & Fund Account'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* PROCESSING */}
        {topUpState === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-bold text-lg">Processing top-up...</p>
              <p className="text-sm text-muted-foreground mt-1">Transferring funds to your XBS account</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
          </motion.div>
        )}

        {/* SUCCESS */}
        {topUpState === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
              className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </motion.div>
            <div>
              <p className="font-bold text-lg">Account funded successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">Your balance has been updated. Proceeding to payment.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(fundingGap.required).filter(([, v]) => v > 0).map(([cur, amt]) => (
                <div key={cur} className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-center">
                  <p className="text-[10px] text-muted-foreground">{cur} funded</p>
                  <p className="font-bold text-sm text-accent">{currencySymbols[cur]}{amt.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <Button onClick={onProceed} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
              Proceed to Payment <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}