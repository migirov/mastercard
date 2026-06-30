import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  X, Zap, CreditCard, ArrowRight, Globe, Wallet,
  ShoppingBag, Plane, Utensils, Banknote, ChevronLeft, ChevronRight
} from 'lucide-react';

const SLIDES = [
  {
    id: 'payments',
    gradient: 'from-slate-900/95 via-blue-950/90 to-cyan-900/80',
    accent1: 'rgba(6,182,212,0.2)',
    accent2: 'rgba(59,130,246,0.15)',
    bg: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80',
    tag: 'NEW FEATURE',
    tagColor: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    tagIcon: <Zap className="w-3 h-3 text-cyan-400" />,
    badge: null,
    title: <>Did you know you can now make{' '}
      <span className="text-cyan-400">cross-border payments</span>{' '}
      directly from your Accounts Payable module?</>,
    subtitle: 'Send money internationally — faster, at lower cost, and without leaving your workflow. Powered by Altshuler Shaham.',
    cta: 'Join now',
    ctaClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    ctaIcon: <ArrowRight className="w-4 h-4 ml-2" />,
    secondary: null,
    visual: (
      <div className="hidden sm:flex items-center justify-center">
        <div className="relative w-40 h-28">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-cyan-400/20 flex items-center justify-center">
            <Globe className="w-14 h-14 text-cyan-400/60" />
          </div>
          {['🇺🇸', '🇪🇺', '🇬🇧', '🇮🇱'].map((flag, i) => (
            <motion.div
              key={i}
              className="absolute text-lg"
              style={{
                top: i < 2 ? '8px' : 'auto',
                bottom: i >= 2 ? '8px' : 'auto',
                left: i % 2 === 0 ? '8px' : 'auto',
                right: i % 2 !== 0 ? '8px' : 'auto',
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ delay: i * 0.3, duration: 2, repeat: Infinity }}
            >
              {flag}
            </motion.div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'cards',
    gradient: 'from-slate-900/95 via-slate-900/85 to-blue-900/90',
    accent1: 'rgba(99,102,241,0.25)',
    accent2: 'rgba(16,185,129,0.15)',
    bg: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&q=80',
    tag: 'NEW',
    tagColor: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    tagIcon: <Zap className="w-3 h-3 text-yellow-400" />,
    title: <>Issue{' '}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
        Mastercard Virtual Cards
      </span>{' '}
      for your employees</>,
    subtitle: 'Create, control and monitor employee spending — salary, travel, meals & more. Set limits, block categories, and manage by team.',
    cta: 'Create new account',
    ctaClass: 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700',
    ctaIcon: <ArrowRight className="w-4 h-4 ml-2" />,
    secondary: 'I have an existing account',
    chips: [
      { icon: Wallet, label: 'Salary', color: 'bg-violet-500/20 text-violet-300 border-violet-400/20' },
      { icon: ShoppingBag, label: 'Spend', color: 'bg-blue-500/20 text-blue-300 border-blue-400/20' },
      { icon: Plane, label: 'Travel', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/20' },
      { icon: Utensils, label: 'Meals', color: 'bg-orange-500/20 text-orange-300 border-orange-400/20' },
      { icon: Banknote, label: 'Budget', color: 'bg-pink-500/20 text-pink-300 border-pink-400/20' },
    ],
    visual: (
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
    ),
  },
];

export default function CombinedActivationBanner({ onDismiss, onJoinPayments, onCreateCards, onHaveAccount }) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];

  const handleCta = () => {
    if (current.id === 'payments') onJoinPayments?.();
    else onCreateCards?.();
  };

  const handleSecondary = () => {
    if (current.id === 'cards') onHaveAccount?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 24 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="relative max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ minHeight: 420 }}
      >
        {/* Animated BG transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <img src={current.bg} alt="" className="w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-br ${current.gradient}`} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 20% 30%, ${current.accent1}, transparent 55%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 80% 70%, ${current.accent2}, transparent 50%)` }} />
          </motion.div>
        </AnimatePresence>

        {/* Close */}
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Slide dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`rounded-full transition-all duration-300 ${i === slide ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>

        <div className="relative z-10 p-8 md:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-black/40 shrink-0 p-1">
                <img
                  src="/partner-logo.svg"
                  alt="Altshuler Shaham"
                  className="w-full h-full object-contain"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Powered by</p>
                <p className="text-sm font-bold text-white leading-tight">Altshuler Shaham</p>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${current.tagColor}`}>
              {current.tagIcon}
              <span className="text-xs font-semibold uppercase tracking-widest">{current.tag}</span>
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-start gap-6 mb-6">
                {current.visual}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight text-white mb-3">
                    {current.title}
                  </h2>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {current.subtitle}
                  </p>
                  {current.chips && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {current.chips.map(({ icon: Icon, label, color }) => (
                        <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
                          <Icon className="w-3 h-3" />
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleCta}
                  size="lg"
                  className={`flex-1 text-white font-semibold py-6 text-base rounded-xl shadow-xl border-0 ${current.ctaClass}`}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {current.cta}
                  {current.ctaIcon}
                </Button>
                {current.secondary && (
                  <Button
                    onClick={handleSecondary}
                    size="lg"
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10 hover:text-white font-semibold py-6 text-base rounded-xl bg-white/5"
                  >
                    {current.secondary}
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav arrows */}
        <button
          onClick={() => setSlide(s => Math.max(0, s - 1))}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all ${slide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => setSlide(s => Math.min(SLIDES.length - 1, s + 1))}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all ${slide === SLIDES.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </motion.div>
    </motion.div>
  );
}