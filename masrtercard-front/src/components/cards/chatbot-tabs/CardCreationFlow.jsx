import React, { useState } from 'react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ChevronRight, ChevronLeft, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PURPOSES = [
  { value: 'spend', label: 'General Spend', icon: '💳', desc: 'Day-to-day expenses' },
  { value: 'salary', label: 'Salary', icon: '💰', desc: 'Payroll payments' },
  { value: 'travel', label: 'Travel', icon: '✈️', desc: 'Flights & hotels' },
  { value: 'meals', label: 'Meals & Food', icon: '🍽️', desc: 'Restaurants & cafes' },
  { value: 'software', label: 'Software', icon: '💻', desc: 'SaaS & subscriptions' },
  { value: 'hardware', label: 'Hardware', icon: '🖥️', desc: 'Equipment & devices' },
  { value: 'marketing', label: 'Marketing', icon: '📢', desc: 'Ads & campaigns' },
  { value: 'other', label: 'Other', icon: '📦', desc: 'Custom purpose' },
];

const MERCHANT_CATEGORIES = ['restaurants', 'supermarkets', 'fuel', 'travel', 'software', 'hardware', 'entertainment', 'health', 'education', 'other'];

const STEPS = ['Employee', 'Purpose', 'Limits', 'Confirm'];

function generateCard() {
  const last4 = Math.floor(1000 + Math.random() * 9000).toString();
  const mm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const yy = String(new Date().getFullYear() + 3).slice(2);
  return { last4, expiry: `${mm}/${yy}` };
}

export default function CardCreationFlow({ employees, preselectedEmployee, onCreated }) {
  const [step, setStep] = useState(preselectedEmployee ? 1 : 0);
  const [form, setForm] = useState({
    employee: preselectedEmployee || null,
    purpose: '',
    card_name: '',
    card_type: 'personal',
    monthly_limit: '',
    single_limit: '',
    allowed_categories: [],
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const toggleCat = (cat) => {
    setForm(f => ({
      ...f,
      allowed_categories: f.allowed_categories.includes(cat)
        ? f.allowed_categories.filter(c => c !== cat)
        : [...f.allowed_categories, cat]
    }));
  };

  const handleCreate = async () => {
    setSaving(true);
    const { last4, expiry } = generateCard();
    const purposeLabel = PURPOSES.find(p => p.value === form.purpose)?.label || form.purpose;
    try {
      await api.entities.VirtualCard.create({
        card_name: form.card_name || `${form.employee.full_name} – ${purposeLabel}`,
        employee_id: form.employee.id,
        employee_name: form.employee.full_name,
        card_type: form.card_type,
        purpose: form.purpose,
        status: 'active',
        monthly_limit: parseFloat(form.monthly_limit) || 0,
        single_transaction_limit: parseFloat(form.single_limit) || 0,
        allowed_categories: form.allowed_categories,
        last4,
        expiry,
        department: form.employee.department,
        total_spent_this_month: 0,
      });
      setDone(true);
      setTimeout(() => onCreated(), 1500);
    } catch {
      /* ignore in the demo — release the button so the user can retry */
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="font-bold text-lg">Card Created!</h3>
        <p className="text-sm text-muted-foreground">Virtual Mastercard is now active for {form.employee?.full_name}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 ${i < step ? 'text-emerald-600' : i === step ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  i < step ? 'bg-emerald-100' : i === step ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-emerald-200' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <AnimatePresence mode="wait">
          {/* Step 0: Select Employee */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="font-semibold mb-1">Select Employee</h3>
              <p className="text-xs text-muted-foreground mb-4">Who is this card for?</p>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {employees.map(emp => (
                  <button key={emp.id}
                    onClick={() => { setForm(f => ({ ...f, employee: emp })); setStep(1); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${
                      form.employee?.id === emp.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {emp.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.role} · {emp.department}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
                {employees.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">No employees found</div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 1: Purpose */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="font-semibold mb-1">Card Purpose</h3>
              <p className="text-xs text-muted-foreground mb-4">What will this card be used for?</p>
              <div className="grid grid-cols-2 gap-2">
                {PURPOSES.map(p => (
                  <button key={p.value}
                    onClick={() => { setForm(f => ({ ...f, purpose: p.value })); setStep(2); }}
                    className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${
                      form.purpose === p.value ? 'border-primary bg-primary/5' : 'border-border'
                    }`}>
                    <span className="text-xl">{p.icon}</span>
                    <span className="font-medium text-sm">{p.label}</span>
                    <span className="text-[11px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Limits */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="font-semibold mb-1">Set Limits & Restrictions</h3>
              <p className="text-xs text-muted-foreground mb-4">Configure spending controls for this card</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Card Name (optional)</label>
                  <Input placeholder={`${form.employee?.full_name} – ${PURPOSES.find(p=>p.value===form.purpose)?.label}`}
                    value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))} className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Monthly Limit (₪)</label>
                    <Input type="number" placeholder="e.g. 5000"
                      value={form.monthly_limit} onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))} className="h-9" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Per Transaction (₪)</label>
                    <Input type="number" placeholder="e.g. 500"
                      value={form.single_limit} onChange={e => setForm(f => ({ ...f, single_limit: e.target.value }))} className="h-9" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Allowed merchant categories</label>
                  <p className="text-[11px] text-muted-foreground mb-2">Leave empty to allow all</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MERCHANT_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => toggleCat(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium capitalize transition-colors ${
                          form.allowed_categories.includes(cat)
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="font-semibold mb-4">Confirm Card Details</h3>
              {/* Virtual card preview */}
              <div className="relative w-full h-44 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-white p-5 mb-5 overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] opacity-60 uppercase tracking-wider">Virtual Card</p>
                    <p className="font-bold text-base">{form.card_name || `${form.employee?.full_name} – ${PURPOSES.find(p=>p.value===form.purpose)?.label}`}</p>
                  </div>
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-red-400 opacity-90" />
                    <div className="w-8 h-8 rounded-full bg-yellow-400 opacity-90" />
                  </div>
                </div>
                <p className="font-mono text-base tracking-widest">•••• •••• •••• ••••</p>
                <div className="flex justify-between items-end mt-3">
                  <div>
                    <p className="text-[9px] opacity-60">CARDHOLDER</p>
                    <p className="text-sm font-medium uppercase">{form.employee?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] opacity-60">EXPIRES</p>
                    <p className="text-sm font-mono">••/••</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {[
                  ['Employee', form.employee?.full_name],
                  ['Department', form.employee?.department],
                  ['Purpose', PURPOSES.find(p=>p.value===form.purpose)?.label],
                  ['Monthly Limit', form.monthly_limit ? `₪${parseFloat(form.monthly_limit).toLocaleString()}` : 'No limit'],
                  ['Per Transaction', form.single_limit ? `₪${parseFloat(form.single_limit).toLocaleString()}` : 'No limit'],
                  ['Allowed Categories', form.allowed_categories.length ? form.allowed_categories.join(', ') : 'All'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        {step === 2 && (
          <Button className="flex-1" onClick={() => setStep(3)}>
            Review <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        {step === 3 && (
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : '✓ Create Virtual Card'}
          </Button>
        )}
      </div>
    </div>
  );
}