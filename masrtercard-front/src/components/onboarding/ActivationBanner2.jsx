import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Globe, ArrowRight, X, Zap } from 'lucide-react';

export default function ActivationBanner2({ onJoinNow, onDismiss }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-8 md:p-12 max-w-2xl w-full text-white overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.1),transparent_50%)]" />

          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-indigo-400" />
              </div>
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-yellow-400">New Option Available</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              Another way to make{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                cross-border payments
              </span>{' '}
              — directly from your AP module.
            </h2>

            <p className="text-white/60 text-lg mb-8 leading-relaxed">
              A certified payment institution — SWIFT enabled, PSD2 compliant, and fully integrated.
            </p>

            <Button
              onClick={onJoinNow}
              size="lg"
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-semibold px-8 py-6 text-base rounded-xl shadow-xl shadow-indigo-500/25"
            >
              Join now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}