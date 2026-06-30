import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2, Loader2, ArrowRight, Globe } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const steps = [
  { id: 'form', title: 'Open Your Account' },
  { id: 'processing', title: 'Processing' },
  { id: 'activated', title: 'Account Active' },
];

function OnboardingContent({ onComplete }) {
  const [currentStep, setCurrentStep] = useState('form');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({
    companyName: '',
    registrationNumber: '',
    country: '',
    contactName: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setCurrentStep('processing');
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => setCurrentStep('activated'), 500);
      }
      setProgress(Math.min(p, 100));
    }, 400);
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1">
            <img
              src="/partner-logo.svg"
              alt="Altshuler Shaham"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Partner Bank</p>
            <p className="font-bold">Altshuler Shaham</p>
          </div>
        </div>
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <div key={step.id} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${
                step.id === currentStep || steps.findIndex(s => s.id === currentStep) > i
                  ? 'bg-primary' : 'bg-white/20'
              }`} />
              <p className="text-[10px] mt-1.5 text-white/50">{step.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {currentStep === 'form' && (
            <motion.form key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Open your cross-border account</h3>
                <p className="text-sm text-muted-foreground">Start sending money internationally — faster and at lower cost.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Company Name</Label>
                  <Input value={form.companyName} onChange={(e) => setForm({...form, companyName: e.target.value})} placeholder="SME Corp Ltd." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Registration Number</Label>
                  <Input value={form.registrationNumber} onChange={(e) => setForm({...form, registrationNumber: e.target.value})} placeholder="515-123456" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({...form, country: e.target.value})} placeholder="Israel" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input value={form.contactName} onChange={(e) => setForm({...form, contactName: e.target.value})} placeholder="John Doe" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="john@sme.com" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Phone Number</Label>
                  <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="+972-50-1234567" className="mt-1" />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">Your data is protected with bank-grade encryption and complies with local regulations.</p>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-semibold">
                Open my account <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.form>
          )}

          {currentStep === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Processing your application...</h3>
              <p className="text-sm text-muted-foreground mb-6">This won't take long — we're verifying your details.</p>
              <Progress value={progress} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
            </motion.div>
          )}

          {currentStep === 'activated' && (
            <motion.div key="activated" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-accent" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">Your account is open!</h3>
              <p className="text-sm text-muted-foreground mb-4">Your account is ready. Fund it by transferring from your bank to start making cross-border payments.</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { code: 'ILS', amount: '0', symbol: '₪', flag: '🇮🇱' },
                  { code: 'USD', amount: '0', symbol: '$', flag: '🇺🇸' },
                  { code: 'EUR', amount: '0', symbol: '€', flag: '🇪🇺' },
                ].map((b) => (
                  <div key={b.code} className="p-3 rounded-xl bg-muted/50 border border-border">
                    <span className="text-lg">{b.flag}</span>
                    <p className="text-xs text-muted-foreground mt-1">{b.code}</p>
                    <p className="font-bold text-sm text-muted-foreground">{b.symbol}{b.amount}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-left mb-6">
                <p className="text-xs font-semibold text-blue-800 mb-1">Bank Transfer Details</p>
                <p className="text-xs text-blue-700">Bank: Altshuler Shaham</p>
                <p className="text-xs text-blue-700">Account: IL12 0108 0000 0001 2345 678</p>
                <p className="text-xs text-blue-700">Reference: Your company name</p>
                <p className="text-xs text-muted-foreground mt-2">Funds will appear within 1–2 business days.</p>
              </div>
              <Button onClick={onComplete} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                <Globe className="w-4 h-4 mr-2" /> Go to dashboard
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Inline version (inside chatbot)
export function BankOnboardingInline({ onComplete }) {
  return (
    <div className="w-full overflow-hidden overflow-y-auto h-full">
      <OnboardingContent onComplete={onComplete} />
    </div>
  );
}

// Modal version (standalone overlay)
export default function BankOnboarding({ onComplete, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <OnboardingContent onComplete={onComplete} />
      </motion.div>
    </motion.div>
  );
}