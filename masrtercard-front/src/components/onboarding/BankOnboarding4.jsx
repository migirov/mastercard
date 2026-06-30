import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2, Loader2, ArrowRight, Globe, X, Building2, Plus, Minus, Landmark, ArrowLeftRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const steps = [
  { id: 'form', title: 'Open Account' },
  { id: 'processing', title: 'KYB Review' },
  { id: 'accounts_ready', title: 'Accounts Ready' },
  { id: 'funding', title: 'Fund Accounts' },
  { id: 'activated', title: 'Active' },
];

const CURRENCIES = [
  { code: 'ILS', symbol: '₪', flag: '🇮🇱', label: 'Israeli Shekel' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', label: 'Euro' },
];

function FundingRow({ currency, value, onChange }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
      <span className="text-xl">{currency.flag}</span>
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{currency.code} Account</p>
        <p className="text-[10px] text-muted-foreground">{currency.label}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 10000))}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency.symbol}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
            className="w-28 h-8 pl-6 pr-2 text-sm font-semibold border border-border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(value + 10000)}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function OnboardingContent4({ onComplete }) {
  const [currentStep, setCurrentStep] = useState('form');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({ companyName: '', registrationNumber: '', country: '', contactName: '', email: '', phone: '' });
  const [funding, setFunding] = useState({ ILS: 100000, USD: 50000, EUR: 25000 });
  const [transferring, setTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setCurrentStep('processing');
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 18 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => setCurrentStep('accounts_ready'), 500);
      }
      setProgress(Math.min(p, 100));
    }, 350);
  };

  const handleFundAccounts = () => {
    setTransferring(true);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 20 + 8;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => setCurrentStep('activated'), 600);
      }
      setTransferProgress(Math.min(p, 100));
    }, 300);
  };

  const currentStepIdx = steps.findIndex(s => s.id === currentStep);

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Partner Bank</p>
            <p className="font-bold">Bank X</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {steps.map((step, i) => (
            <div key={step.id} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${
                currentStepIdx > i ? 'bg-emerald-400' : step.id === currentStep ? 'bg-primary' : 'bg-white/20'
              }`} />
              <p className="text-[9px] mt-1.5 text-white/40 truncate">{step.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">

          {/* Step 1: Form */}
          {currentStep === 'form' && (
            <motion.form key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Open your cross-border account</h3>
                <p className="text-sm text-muted-foreground">Register with Bank X to enable international payments.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Company Name</Label>
                  <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="SME Corp Ltd." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Registration Number</Label>
                  <Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="515-123456" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Israel" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="John Doe" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@sme.com" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Phone Number</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+972-50-1234567" className="mt-1" />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">Your data is protected with bank-grade encryption and complies with local regulations.</p>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-semibold">
                Submit application <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.form>
          )}

          {/* Step 2: KYB Processing */}
          {currentStep === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">KYB Review in Progress</h3>
              <p className="text-sm text-muted-foreground mb-6">We're verifying your business details. This takes just a moment.</p>
              <Progress value={progress} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
            </motion.div>
          )}

          {/* Step 3: Accounts Ready — balance is 0 */}
          {currentStep === 'accounts_ready' && (
            <motion.div key="accounts_ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-4">
              <div className="text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                  className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </motion.div>
                <h3 className="text-xl font-bold mb-1">KYB Approved!</h3>
                <p className="text-sm text-muted-foreground">Your accounts have been opened. Current balance is <strong>₪0 / $0 / €0</strong> — fund them to start making payments.</p>
              </div>

              <div className="space-y-2">
                {CURRENCIES.map(cur => (
                  <div key={cur.code} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <span className="text-xl">{cur.flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{cur.code} Account</p>
                      <p className="text-xs text-muted-foreground">Account opened — awaiting funding</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-muted-foreground">{cur.symbol}0</p>
                      <p className="text-[10px] text-orange-500 font-medium">Unfunded</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => setCurrentStep('funding')} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                <ArrowLeftRight className="w-4 h-4 mr-2" /> Fund my accounts
              </Button>
            </motion.div>
          )}

          {/* Step 4: Fund from Bank X */}
          {currentStep === 'funding' && (
            <motion.div key="funding" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 py-2">
              {!transferring ? (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-primary" />
                      <h3 className="text-lg font-bold">Transfer from Bank X</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Choose how much to transfer from your existing Bank X account to each currency account.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700">Source: Bank X — Company Account</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">Funds will be transferred via bank wire. Processing time: up to 1 business day.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {CURRENCIES.map(cur => (
                      <FundingRow
                        key={cur.code}
                        currency={cur}
                        value={funding[cur.code]}
                        onChange={(val) => setFunding(prev => ({ ...prev, [cur.code]: val }))}
                      />
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Total transfer from Bank X</p>
                    <div className="flex gap-4">
                      {CURRENCIES.map(cur => (
                        <div key={cur.code}>
                          <span className="text-xs font-bold">{cur.symbol}{funding[cur.code].toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{cur.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleFundAccounts} className="w-full bg-primary hover:bg-primary/90 font-semibold" disabled={funding.ILS + funding.USD + funding.EUR === 0}>
                    <ArrowLeftRight className="w-4 h-4 mr-2" /> Transfer funds now
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <ArrowLeftRight className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-1">Transferring funds...</h3>
                  <p className="text-sm text-muted-foreground mb-6">Wiring from Bank X to your XBS accounts.</p>
                  <Progress value={transferProgress} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">{Math.round(transferProgress)}% complete</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 5: Activated */}
          {currentStep === 'activated' && (
            <motion.div key="activated" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </motion.div>
              <div>
                <h3 className="text-xl font-bold mb-1">Accounts funded & active!</h3>
                <p className="text-sm text-muted-foreground">Funds transferred from Bank X. You're ready to make cross-border payments.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {CURRENCIES.map(cur => (
                  <div key={cur.code} className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-lg">{cur.flag}</span>
                    <p className="text-xs text-muted-foreground mt-1">{cur.code}</p>
                    <p className="font-bold text-sm text-emerald-700">{cur.symbol}{funding[cur.code].toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => onComplete(funding)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                <Globe className="w-4 h-4 mr-2" /> Start making payments
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  );
}

export function BankOnboardingInline4({ onComplete }) {
  return (
    <div className="w-full overflow-hidden overflow-y-auto h-full">
      <OnboardingContent4 onComplete={onComplete} />
    </div>
  );
}

export default function BankOnboarding4({ onComplete, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative max-h-[90vh] overflow-y-auto">
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
            <X className="w-4 h-4" />
          </button>
        )}
        <OnboardingContent4 onComplete={onComplete} />
      </motion.div>
    </motion.div>
  );
}