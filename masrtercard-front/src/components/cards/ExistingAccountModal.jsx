import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  X, ArrowRight, ArrowLeft, Building2, Banknote, RefreshCw,
  TrendingUp, CheckCircle2, Loader2, ArrowUpDown, Info, Shield
} from 'lucide-react';

// ── Mock data ──────────────────────────────────────────────────────────────────
const ACCOUNTS = [
  {
    id: 'main',
    name: 'חשבון ראשי',
    label: 'Main',
    color: 'from-blue-600 to-blue-800',
    balances: { ILS: 247850, USD: 32400, EUR: 18900 },
    accountNum: '123-456789',
  },
  {
    id: 'payroll',
    name: 'שכר עובדים',
    label: 'Payroll',
    color: 'from-violet-600 to-violet-800',
    balances: { ILS: 180000, USD: 0, EUR: 0 },
    accountNum: '123-987654',
  },
  {
    id: 'travel',
    name: 'נסיעות והוצאות',
    label: 'Travel & Expenses',
    color: 'from-emerald-600 to-emerald-800',
    balances: { ILS: 42000, USD: 8500, EUR: 5200 },
    accountNum: '123-556677',
  },
];

const FX_RATES = {
  ILS_USD: 0.274, USD_ILS: 3.648,
  ILS_EUR: 0.252, EUR_ILS: 3.968,
  USD_EUR: 0.920, EUR_USD: 1.087,
};

const CURRENCIES = [
  { code: 'ILS', symbol: '₪', flag: '🇮🇱', name: 'שקל' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'דולר' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'יורו' },
];

function getFxRate(from, to) {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  return FX_RATES[key] || 1;
}

function fmt(amount, symbol) {
  return `${symbol}${Number(amount).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ account, selected, onClick }) {
  const total_ils = account.balances.ILS
    + account.balances.USD * FX_RATES.USD_ILS
    + account.balances.EUR * FX_RATES.EUR_ILS;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl overflow-hidden border-2 transition-all ${
        selected ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/40'
      }`}
    >
      <div className={`bg-gradient-to-br ${account.color} p-4 text-white`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">{account.label}</p>
            <p className="font-bold">{account.name}</p>
          </div>
          {selected && <CheckCircle2 className="w-5 h-5 text-white" />}
        </div>
        <p className="text-xs text-white/50 mb-1">סה"כ שווי ₪</p>
        <p className="text-xl font-bold font-mono">{fmt(total_ils, '₪')}</p>
      </div>
      <div className="bg-card px-4 py-3 grid grid-cols-3 divide-x divide-border">
        {CURRENCIES.map(c => (
          <div key={c.code} className="px-2 first:pl-0 last:pr-0">
            <p className="text-[10px] text-muted-foreground">{c.flag} {c.code}</p>
            <p className="text-sm font-semibold font-mono">{fmt(account.balances[c.code], c.symbol)}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── FX Module ─────────────────────────────────────────────────────────────────
function FxModule() {
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('ILS');
  const [amount, setAmount] = useState('1000');

  const rate = getFxRate(fromCur, toCur);
  const result = (parseFloat(amount) || 0) * rate;

  const swap = () => { setFromCur(toCur); setToCur(fromCur); };

  const fromC = CURRENCIES.find(c => c.code === fromCur);
  const toC = CURRENCIES.find(c => c.code === toCur);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold">מחשבון FX</span>
        <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">שערים חיים</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">מ-</Label>
          <div className="flex mt-1">
            <select
              value={fromCur}
              onChange={e => setFromCur(e.target.value)}
              className="h-9 rounded-l-md border border-r-0 border-input bg-background px-2 text-sm focus:outline-none"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="rounded-l-none flex-1 font-mono"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">ל-</Label>
          <div className="flex mt-1">
            <select
              value={toCur}
              onChange={e => setToCur(e.target.value)}
              className="h-9 rounded-l-md border border-r-0 border-input bg-background px-2 text-sm focus:outline-none"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <div className="flex-1 h-9 rounded-r-md border border-input bg-muted/60 flex items-center px-3 font-mono text-sm font-semibold">
              {result.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          שער: <span className="font-bold text-foreground">1 {fromCur} = {rate.toFixed(4)} {toCur}</span>
        </div>
        <button
          onClick={swap}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" /> החלף
        </button>
      </div>

      {/* All rates table */}
      <div className="border-t border-border pt-3">
        <p className="text-[11px] text-muted-foreground mb-2 font-medium">שערי המרה נוכחיים</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { pair: 'USD/ILS', rate: FX_RATES.USD_ILS, flag1: '🇺🇸', flag2: '🇮🇱' },
            { pair: 'EUR/ILS', rate: FX_RATES.EUR_ILS, flag1: '🇪🇺', flag2: '🇮🇱' },
            { pair: 'EUR/USD', rate: FX_RATES.EUR_USD, flag1: '🇪🇺', flag2: '🇺🇸' },
          ].map(r => (
            <div key={r.pair} className="bg-background border border-border rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{r.flag1}{r.flag2} {r.pair}</p>
              <p className="text-sm font-bold font-mono">{r.rate.toFixed(3)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Fund From Bank Step ────────────────────────────────────────────────────────
function FundFromBank({ account, onDone, onBack }) {
  const [step, setStep] = useState('form'); // form | processing | done
  const [currency, setCurrency] = useState('ILS');
  const [amount, setAmount] = useState('50000');
  const [progress, setProgress] = useState(0);

  const startTransfer = () => {
    setStep('processing');
    let p = 0;
    const msgs = ['מאמת פרטי חשבון...', 'יוצר בקשת העברה...', 'מאשר...', 'מזכה יתרה...', 'הושלם!'];
    const interval = setInterval(() => {
      p += Math.random() * 20 + 8;
      if (p >= 100) { p = 100; clearInterval(interval); setTimeout(() => setStep('done'), 500); }
      setProgress(Math.min(p, 100));
    }, 400);
  };

  const curInfo = CURRENCIES.find(c => c.code === currency);

  if (step === 'processing') return (
    <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-10">
      <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
      <h3 className="font-bold text-lg mb-2">מעבד העברה...</h3>
      <p className="text-sm text-muted-foreground mb-5">בנק הפועלים מעבד את בקשתך</p>
      <Progress value={progress} className="h-2 mb-2" />
      <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
    </motion.div>
  );

  if (step === 'done') return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </motion.div>
      <h3 className="text-xl font-bold mb-2">ההעברה בוצעה!</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {curInfo.symbol}{Number(amount).toLocaleString()} {currency} יתווספו לחשבון <strong>{account.name}</strong>
      </p>
      <div className="p-3 rounded-xl bg-muted/50 border border-border text-sm mb-5 space-y-1.5">
        <div className="flex justify-between"><span className="text-muted-foreground">מקור</span><span>בנק הפועלים 632/123456</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">סכום</span><span className="font-bold">{curInfo.symbol}{Number(amount).toLocaleString()} {currency}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">סטטוס</span><span className="text-emerald-600 font-semibold">הושלם ✓</span></div>
      </div>
      <Button onClick={onDone} className="w-full">סגור</Button>
    </motion.div>
  );

  return (
    <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <h3 className="text-lg font-bold">טעינה מבנק הפועלים</h3>
          <p className="text-xs text-muted-foreground">לחשבון: {account.name}</p>
        </div>
      </div>

      {/* Bank card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-red-700 to-red-500 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-bold">בנק הפועלים</span>
          </div>
          <span className="text-white/50 text-xs">סניף 632</span>
        </div>
        <p className="font-mono font-bold tracking-widest">632 — 123456</p>
        <div className="flex justify-between mt-1.5 text-[10px] text-white/50">
          <span>IBAN: IL62-0125-1000-0001-2345-678</span>
          <span>SWIFT: POALILIT</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">מטבע</Label>
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
          <Label className="text-xs">סכום</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{curInfo.symbol}</span>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="pl-7 font-mono" />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-xs">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>ההעברה מאובטחת. הכסף יזוכה בחשבון הכרטיסים תוך 30 דקות.</span>
      </div>

      <Button onClick={startTransfer} disabled={!amount || Number(amount) <= 0} className="w-full font-semibold gap-2">
        <Banknote className="w-4 h-4" /> העבר {curInfo.symbol}{Number(amount || 0).toLocaleString()} {currency}
        <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

// ── Transfer Between Accounts ──────────────────────────────────────────────────
function InternalTransfer({ accounts, onDone, onBack }) {
  const [fromId, setFromId] = useState(accounts[0].id);
  const [toId, setToId] = useState(accounts[1].id);
  const [fromCur, setFromCur] = useState('ILS');
  const [toCur, setToCur] = useState('ILS');
  const [amount, setAmount] = useState('10000');
  const [step, setStep] = useState('form');
  const [progress, setProgress] = useState(0);

  const rate = getFxRate(fromCur, toCur);
  const resultAmount = (parseFloat(amount) || 0) * rate;
  const fromAcc = accounts.find(a => a.id === fromId);
  const toAcc = accounts.find(a => a.id === toId);
  const fromC = CURRENCIES.find(c => c.code === fromCur);
  const toC = CURRENCIES.find(c => c.code === toCur);

  const startTransfer = () => {
    setStep('processing');
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 20 + 8;
      if (p >= 100) { p = 100; clearInterval(interval); setTimeout(() => setStep('done'), 500); }
      setProgress(Math.min(p, 100));
    }, 350);
  };

  if (step === 'processing') return (
    <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
      <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
      <h3 className="font-bold text-lg mb-2">מעביר...</h3>
      <Progress value={progress} className="h-2 mb-2 mt-4" />
      <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
    </motion.div>
  );

  if (step === 'done') return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </motion.div>
      <h3 className="text-xl font-bold mb-2">ההעברה הצליחה!</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {fromC.symbol}{Number(amount).toLocaleString()} {fromCur} → {toC.symbol}{resultAmount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} {toCur}
      </p>
      <div className="p-3 rounded-xl bg-muted/50 border border-border text-sm mb-5 space-y-1.5">
        <div className="flex justify-between"><span className="text-muted-foreground">מ-</span><span>{fromAcc.name} ({fromCur})</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">ל-</span><span>{toAcc.name} ({toCur})</span></div>
        {fromCur !== toCur && <div className="flex justify-between"><span className="text-muted-foreground">שער FX</span><span className="font-mono">1 {fromCur} = {rate.toFixed(4)} {toCur}</span></div>}
      </div>
      <Button onClick={onDone} className="w-full">סגור</Button>
    </motion.div>
  );

  return (
    <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <h3 className="text-lg font-bold">העברה בין חשבונות</h3>
          <p className="text-xs text-muted-foreground">העבר בין חשבונות — עם המרת מטבע אוטומטית</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">מחשבון</Label>
          <select value={fromId} onChange={e => setFromId(e.target.value)}
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">לחשבון</Label>
          <select value={toId} onChange={e => setToId(e.target.value)}
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
            {accounts.filter(a => a.id !== fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">מטבע מקור</Label>
          <select value={fromCur} onChange={e => setFromCur(e.target.value)}
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">מטבע יעד</Label>
          <select value={toCur} onChange={e => setToCur(e.target.value)}
            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">סכום ({fromCur})</Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{fromC.symbol}</span>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="pl-7 font-mono" />
        </div>
      </div>

      {/* FX preview */}
      {fromCur !== toCur && (
        <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-sm">
          <div>
            <p className="text-xs text-muted-foreground">שער המרה</p>
            <p className="font-mono font-semibold">1 {fromCur} = {rate.toFixed(4)} {toCur}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">יתקבל</p>
            <p className="font-mono font-bold text-primary">{toC.symbol}{resultAmount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} {toCur}</p>
          </div>
        </div>
      )}

      <Button onClick={startTransfer} disabled={!amount || Number(amount) <= 0 || fromId === toId}
        className="w-full font-semibold gap-2">
        <RefreshCw className="w-4 h-4" /> אשר העברה
      </Button>
    </motion.div>
  );
}

// ── Main Modal ──────────────────────────────────────────────────────────────────
export default function ExistingAccountModal({ onClose, onComplete }) {
  const [view, setView] = useState('accounts'); // accounts | fx | fund | transfer
  const [selectedAccount, setSelectedAccount] = useState(ACCOUNTS[0].id);

  const selAcc = ACCOUNTS.find(a => a.id === selectedAccount);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 pt-5 pb-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1">
                <img src="/partner-logo.svg"
                  alt="AS" className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-widest">Powered by</p>
                <p className="text-sm font-bold">Altshuler Shaham</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav tabs */}
          <div className="flex gap-1">
            {[
              { id: 'accounts', label: 'חשבונות' },
              { id: 'fx', label: 'FX' },
              { id: 'transfer', label: 'העברה פנימית' },
              { id: 'fund', label: 'טעינה מבנק' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setView(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === tab.id ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[72vh]">
          <AnimatePresence mode="wait">
            {view === 'accounts' && (
              <motion.div key="accounts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold">החשבונות שלך</h3>
                  <span className="text-xs text-muted-foreground">{ACCOUNTS.length} חשבונות פעילים</span>
                </div>
                {ACCOUNTS.map(acc => (
                  <AccountCard key={acc.id} account={acc} selected={selectedAccount === acc.id}
                    onClick={() => setSelectedAccount(acc.id)} />
                ))}
                <Button onClick={() => { onComplete(); }} className="w-full mt-2 font-semibold gap-2">
                  <CheckCircle2 className="w-4 h-4" /> המשך לניהול כרטיסים
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {view === 'fx' && (
              <motion.div key="fx" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-base font-bold">מחשבון שערי חליפין</h3>
                <FxModule />
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>השערים מתעדכנים בזמן אמת. עסקאות FX מבוצעות בשער הנקוב בזמן הביצוע. עמלת המרה: 0.3%.</span>
                </div>
              </motion.div>
            )}

            {view === 'transfer' && (
              <InternalTransfer accounts={ACCOUNTS} onDone={() => setView('accounts')} onBack={() => setView('accounts')} />
            )}

            {view === 'fund' && (
              <FundFromBank account={selAcc} onDone={() => setView('accounts')} onBack={() => setView('accounts')} />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}