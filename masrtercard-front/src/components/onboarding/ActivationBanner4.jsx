import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Zap, Landmark } from 'lucide-react';

export default function ActivationBanner4({ onJoinNow, onDismiss }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 md:p-12 max-w-2xl w-full text-white overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,113,133,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(251,146,60,0.1),transparent_50%)]" />

          <button onClick={onDismiss} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-black/30">
                  <Landmark className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Powered by</p>
                  <p className="text-xl font-bold text-white leading-tight">Bank X</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-3 py-1.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-yellow-400">New Feature</span>
              </div>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              Make{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">
                cross-border payments
              </span>{' '}
              directly from your Accounts Payable module
            </h2>

            <p className="text-white/60 text-lg mb-8 leading-relaxed">
              Open accounts with Bank X, fund them from your existing company account, and start sending money internationally.
            </p>

            <Button onClick={onJoinNow} size="lg"
              className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold px-8 py-6 text-base rounded-xl shadow-xl">
              Get started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}