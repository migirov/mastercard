import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowRight, Wallet, X, Zap, ShoppingBag, Plane, Utensils, Banknote } from 'lucide-react';

const CARD_FEATURES = [
  { icon: Wallet, label: 'Salary', color: 'bg-violet-500/20 text-violet-300' },
  { icon: ShoppingBag, label: 'Spend', color: 'bg-blue-500/20 text-blue-300' },
  { icon: Plane, label: 'Travel', color: 'bg-emerald-500/20 text-emerald-300' },
  { icon: Utensils, label: 'Meals', color: 'bg-orange-500/20 text-orange-300' },
  { icon: Banknote, label: 'Budget', color: 'bg-pink-500/20 text-pink-300' },
];

export default function CardActivationBanner({ onHaveAccount, onCreateAccount, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="relative max-w-2xl w-full rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Background image + overlays */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-blue-900/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.25),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_50%)]" />
        </div>

        {/* Close */}
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10 p-8 md:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/40 overflow-hidden shrink-0 p-1">
                <img
                  src="/partner-logo.svg"
                  alt="Altshuler Shaham"
                  className="w-full h-full object-contain"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Powered by</p>
                <p className="text-base font-bold text-white leading-tight">Altshuler Shaham</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-yellow-400">New</span>
            </div>
          </div>

          {/* Visual mock card */}
          <div className="mb-8 flex items-start gap-6">
            <div className="hidden sm:block shrink-0">
              <div className="w-44 h-28 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 shadow-xl shadow-blue-900/50 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="text-white/80 text-[8px] font-bold uppercase tracking-widest">Virtual Card</div>
                  <div className="flex -space-x-2">
                    <div className="w-5 h-5 rounded-full bg-red-500/90" />
                    <div className="w-5 h-5 rounded-full bg-yellow-400/90" />
                  </div>
                </div>
                <div>
                  <div className="text-white text-[10px] font-mono tracking-widest mb-1">•••• •••• •••• 4291</div>
                  <div className="flex justify-between">
                    <span className="text-white/60 text-[8px]">Employee Name</span>
                    <span className="text-white/60 text-[8px]">12/28</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-white mb-3">
                Issue{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                  Mastercard Virtual Cards
                </span>{' '}
                for your employees
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                Create, control and monitor employee spending — salary, travel, meals &amp; more. Set limits, block categories, and manage by team — all in one place.
              </p>

              <div className="flex flex-wrap gap-2">
                {CARD_FEATURES.map(({ icon: Icon, label, color }) => (
                  <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color} border border-white/10`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onCreateAccount}
              size="lg"
              className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-semibold py-6 text-base rounded-xl shadow-xl shadow-blue-900/40 border-0"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Create New Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={onHaveAccount}
              size="lg"
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white font-semibold py-6 text-base rounded-xl bg-white/5"
            >
              I Already Have an Account
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}