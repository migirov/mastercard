import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Zap } from 'lucide-react';

export default function ActivationBanner3({ onJoinNow, onDismiss, onHaveAccount }) {
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.1),transparent_50%)]" />

          <button onClick={onDismiss} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center p-1">
                <img
                  src="/partner-logo.svg"
                  alt="Altshuler Shaham"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Powered by</p>
                <p className="font-bold text-sm">Altshuler Shaham</p>
              </div>
              <Zap className="w-5 h-5 text-yellow-400 ml-2" />
              <span className="text-xs font-semibold uppercase tracking-widest text-yellow-400">New Feature</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              Did you know you can now make{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                cross-border payments
              </span>{' '}
              directly from your Accounts Payable module?
            </h2>

            <p className="text-white/60 text-lg mb-8 leading-relaxed">
              Send money internationally — faster, at lower cost, and without leaving your workflow. Powered by Altshuler Shaham.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={onJoinNow}
                size="lg"
                className="bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-semibold px-8 py-6 text-base rounded-xl shadow-xl shadow-primary/25"
              >
                Join now <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {onHaveAccount && (
                <Button
                  onClick={onHaveAccount}
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 hover:text-white font-semibold px-8 py-6 text-base rounded-xl bg-white/5"
                >
                  I have an account
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}