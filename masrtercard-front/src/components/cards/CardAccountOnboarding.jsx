import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  X, Shield, CheckCircle2, Loader2, ArrowRight,
  Building2, CreditCard, ArrowLeft, Banknote, Info
} from 'lucide-react';

const CURRENCIES = [
  { code: 'ILS', symbol: '₪', flag: '🇮🇱' },
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
];

const BANK_PREFILL = {
  bankCode: '12',
  branchNumber: '632',
  accountNumber: '123456',
  accountName: 'Altshuler Shaham Ltd.',
  iban: 'IL62-0125-1000-0001-2345-678',
  swift: 'POALILIT',
};

const steps = [
  { id: 'details', title: 'Account' },
  { id: 'fund', title: 'Funding' },
  { id: 'summary', title: 'Summary' },
  { id: 'processing', title: 'Processing' },
  { id: 'done', title: 'Active' },
];

function StepBar({ currentStep }) {
  const idx = steps.findIndex(s => s.id === currentStep);
  return (
    <div className="flex gap-2 px-6 pb-4">
      {steps.map((s, i) => (
        <div key={s.id} className="flex-1">
          <div className={`h-1 rounded-full transition-colors ${i <= idx ? 'bg-primary' : 'bg-white/20'}`} />
          <p className="text-[9px] mt-1 text-white/40 text-center">{s.title}</p>
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Account details ───────────────────────────────────────────────────
function DetailsStep({ onNext }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('spend');

  const PURPOSES = [
    { id: 'spend', label: 'General Expenses' },
    { id: 'payroll', label: 'Employee Payroll' },
    { id: 'travel', label: 'Travel' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'it', label: 'IT & Software' },
  ];

  return (
    <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-5">
      <div>
        <h3 className="text-xl font-bold mb-1">Open a New Card Account</h3>
        <p className="text-sm text-muted-foreground">The account opens with a 0 balance — you can fund it immediately after opening.</p>
      </div>

      <div>
        <Label className="text-xs">Account Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder='e.g. "Q2 Payroll Account"' className="mt-1" />
      </div>

      <div>
        <Label className="text-xs mb-2 block">Account Purpose</Label>
        <div className="grid grid-cols-2 gap-2">
          {PURPOSES.map(p => (
            <button key={p.id} onClick={() => setPurpose(p.id)}
              className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                purpose === p.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zero balance preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Starting Balances</span>
          <span className="text-[10px] text-muted-foreground">Can be funded after opening</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border px-4 py-3">
          {CURRENCIES.map(c => (
            <div key={c.code} className="px-3 first:pl-0 last:pr-0">
              <p className="text-[10px] text-muted-foreground">{c.flag} {c.code}</p>
              <p className="text-base font-bold font-mono text-muted-foreground">{c.symbol}0</p>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => onNext({ name: name || 'New Card Account', purpose })}
        disabled={!name.trim()}
        className="w-full font-semibold gap-2">
        Continue to Funding Setup <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

// ── Step 2: Fund from bank ────────────────────────────────────────────────────
function FundStep({ onNext, onBack, onSkip }) {
  const [currency, setCurrency] = useState('ILS');
  const [amount, setAmount] = useState('50000');
  const curInfo = CURRENCIES.find(c => c.code === currency);

  return (
    <motion.div key="fund" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <h3 className="text-lg font-bold">Initial Funding</h3>
          <p className="text-xs text-muted-foreground">Add balance to the new account from Bank Hapoalim</p>
        </div>
      </div>

      {/* Bank card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-bold">Bank Hapoalim</span>
          </div>
          <span className="text-white/50 text-xs">Bank Code: {BANK_PREFILL.bankCode}</span>
        </div>
        <p className="font-mono font-bold tracking-widest">{BANK_PREFILL.branchNumber} — {BANK_PREFILL.accountNumber}</p>
        <div className="flex justify-between mt-2 text-[10px] text-white/50">
          <span>IBAN: {BANK_PREFILL.iban}</span>
          <span>SWIFT: {BANK_PREFILL.swift}</span>
        </div>
      </div>

      <div>
        <Label className="text-xs">Currency</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => setCurrency(c.code)}
              className={`p-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                currency === c.code ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'
              }`}>
              {c.flag} {c.code}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Transfer Amount</Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">{curInfo.symbol}</span>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="pl-7 font-mono" />
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-xs">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>The account opens with a 0 balance. Funds will be credited after the bank transfer is received (up to 30 minutes).</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1 text-sm">
          Skip — Fund Later
        </Button>
        <Button onClick={() => onNext({ currency, amount })}
          disabled={!amount || Number(amount) <= 0}
          className="flex-1 font-semibold gap-1">
          <Banknote className="w-4 h-4" /> Continue
        </Button>
      </div>
    </motion.div>
  );
}

// ── Step 3: Summary ───────────────────────────────────────────────────────────
function SummaryStep({ accountData, fundData, onNext, onBack }) {
  const curInfo = fundData ? CURRENCIES.find(c => c.code === fundData.currency) : null;

  return (
    <motion.div key="summary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <h3 className="text-lg font-bold">Summary Before Confirmation</h3>
          <p className="text-xs text-muted-foreground">Review the details before opening</p>
        </div>
      </div>

      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">New Account Details</span>
        </div>
        {[
          { label: 'Account Name', value: accountData.name },
          { label: 'Purpose', value: accountData.purpose },
          { label: 'Opening Balance', value: '₪0 / $0 / €0', muted: true },
          ...(fundData ? [
            { label: 'Initial Funding', value: `${curInfo.symbol}${Number(fundData.amount).toLocaleString()} ${fundData.currency}`, bold: true },
            { label: 'Source', value: `Bank Hapoalim ${BANK_PREFILL.branchNumber}/${BANK_PREFILL.accountNumber}` },
            { label: 'Fee', value: 'No fee', green: true },
          ] : [
            { label: 'Initial Funding', value: 'None — Fund later', muted: true },
          ]),
        ].map(row => (
          <div key={row.label} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`font-medium ${row.bold ? 'font-bold' : ''} ${row.green ? 'text-emerald-600 font-semibold' : ''} ${row.muted ? 'text-muted-foreground' : ''}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs">
        <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <span className="text-muted-foreground">Data is encrypted at bank level. The account will open immediately.</span>
      </div>

      <Button onClick={onNext} className="w-full font-semibold bg-emerald-600 hover:bg-emerald-700 gap-2">
        <CheckCircle2 className="w-4 h-4" /> Confirm & Open Account
      </Button>
    </motion.div>
  );
}

// ── Step 4: Processing ────────────────────────────────────────────────────────
function ProcessingStep({ hasFund, onDone }) {
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('Creating account...');
  const msgs = hasFund
    ? ['Creating new account...', 'Setting permissions...', 'Sending transfer request to bank...', 'Waiting for approval...', 'All done!']
    : ['Creating new account...', 'Setting permissions...', 'Activating account...', 'All done!'];

  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 18 + 7;
      const idx = Math.min(Math.floor((p / 100) * msgs.length), msgs.length - 1);
      setMsg(msgs[idx]);
      if (p >= 100) { p = 100; clearInterval(interval); setTimeout(onDone, 500); }
      setProgress(Math.min(p, 100));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="text-center py-12">
      <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-5" />
      <h3 className="text-lg font-bold mb-2">Opening Your Account</h3>
      <p className="text-sm text-muted-foreground mb-6">{msg}</p>
      <Progress value={progress} className="h-2 mb-2" />
      <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
    </motion.div>
  );
}

// ── Step 5: Done ──────────────────────────────────────────────────────────────
function DoneStep({ accountData, fundData, onComplete }) {
  const curInfo = fundData ? CURRENCIES.find(c => c.code === fundData.currency) : null;

  return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}
        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </motion.div>
      <h3 className="text-xl font-bold mb-2">Account Opened!</h3>
      <p className="text-sm text-muted-foreground mb-5">
        <strong>{accountData.name}</strong> opened successfully. {fundData ? 'Transfer is on the way.' : 'You can fund it at any time.'}
      </p>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {CURRENCIES.map(c => {
          const isPending = fundData && fundData.currency === c.code;
          return (
            <div key={c.code} className="p-3 rounded-xl bg-muted/50 border border-border text-center">
              <p className="text-lg">{c.flag}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.code}</p>
              <p className="font-bold text-sm font-mono">{c.symbol}0</p>
              {isPending && (
                <p className="text-[10px] text-blue-500 font-medium mt-0.5">
                  +{c.symbol}{Number(fundData.amount).toLocaleString()} ⏳
                </p>
              )}
            </div>
          );
        })}
      </div>

      {fundData && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 text-left mb-4 space-y-1">
          <div className="flex justify-between"><span>In Transfer (Pending)</span><span className="font-bold">{curInfo.symbol}{Number(fundData.amount).toLocaleString()} {fundData.currency}</span></div>
          <div className="flex justify-between"><span>Source</span><span>Bank Hapoalim {BANK_PREFILL.branchNumber}/{BANK_PREFILL.accountNumber}</span></div>
          <div className="flex justify-between"><span>Estimated Processing Time</span><span>Up to 30 minutes</span></div>
        </div>
      )}

      <Button onClick={onComplete} className="w-full font-semibold gap-2">
        <CreditCard className="w-4 h-4" /> Start Issuing Cards
      </Button>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function OnboardingContent({ onComplete, onClose }) {
  const [step, setStep] = useState('details');
  const [accountData, setAccountData] = useState(null);
  const [fundData, setFundData] = useState(null);

  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 pt-6 pb-4 text-white">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1">
              <img src="/partner-logo.svg"
                alt="AS" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
            </div>
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-medium">Powered by</p>
              <p className="text-sm font-bold leading-tight">Altshuler Shaham</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <StepBar currentStep={step} />
      </div>

      <div className="p-6 overflow-y-auto max-h-[72vh]">
        <AnimatePresence mode="wait">
          {step === 'details' && (
            <DetailsStep onNext={(data) => { setAccountData(data); setStep('fund'); }} />
          )}
          {step === 'fund' && (
            <FundStep
              onNext={(data) => { setFundData(data); setStep('summary'); }}
              onBack={() => setStep('details')}
              onSkip={() => { setFundData(null); setStep('summary'); }}
            />
          )}
          {step === 'summary' && (
            <SummaryStep
              accountData={accountData}
              fundData={fundData}
              onNext={() => setStep('processing')}
              onBack={() => setStep('fund')}
            />
          )}
          {step === 'processing' && (
            <ProcessingStep hasFund={!!fundData} onDone={() => setStep('done')} />
          )}
          {step === 'done' && (
            <DoneStep accountData={accountData} fundData={fundData} onComplete={onComplete} />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function CardAccountOnboarding({ onComplete, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <OnboardingContent onComplete={onComplete} onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}