import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, LogIn, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

// Mock account data keyed by account number
const MOCK_ACCOUNTS = {
  'IL12345678': { ils: 420000, usd: 210000, eur: 95000 },
  'IL87654321': { ils: 55000, usd: 32000, eur: 0 },
};

export default function ExistingPaymentAccountModal({ onClose, onComplete }) {
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Accept any non-empty credentials; use mock data or defaults
      if (!accountNumber || !password) {
        setError('Please fill in all fields.');
        return;
      }
      const found = MOCK_ACCOUNTS[accountNumber.replace(/\s/g, '').toUpperCase()];
      setBalances(found || { ils: 125000, usd: 48000, eur: 21000 });
    }, 1000);
  };

  const handleContinue = () => {
    onComplete({
      balance_ils: balances.ils,
      balance_usd: balances.usd,
      balance_eur: balances.eur,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1">
              <img
                src="/partner-logo.svg"
                alt="Altshuler Shaham"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-wider font-medium">Powered by</p>
              <p className="font-bold text-sm">Altshuler Shaham</p>
            </div>
          </div>
          <h2 className="text-xl font-bold mt-4">Log in to your account</h2>
          <p className="text-white/60 text-sm mt-1">Enter your account details to view your balances.</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {!balances ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. IL12345678"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Logging in...</span>
                ) : (
                  <><LogIn className="w-4 h-4 mr-2" /> Log in</>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">Account verified</span>
              </div>
              <p className="text-sm text-muted-foreground">Your current balances:</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { code: 'ILS', amount: balances.ils, symbol: '₪', flag: '🇮🇱' },
                  { code: 'USD', amount: balances.usd, symbol: '$', flag: '🇺🇸' },
                  { code: 'EUR', amount: balances.eur, symbol: '€', flag: '🇪🇺' },
                ].map(b => (
                  <div key={b.code} className="p-3 rounded-xl bg-muted/50 border border-border text-center">
                    <span className="text-lg">{b.flag}</span>
                    <p className="text-xs text-muted-foreground mt-1">{b.code}</p>
                    <p className="font-bold text-sm">{b.symbol}{b.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <Button onClick={handleContinue} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                Continue to dashboard
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}