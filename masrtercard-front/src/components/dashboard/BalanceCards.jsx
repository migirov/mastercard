import React from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';

const currencies = [
  { code: 'ILS', symbol: '₪', flag: '🇮🇱', color: 'from-blue-500 to-blue-600' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', color: 'from-emerald-500 to-emerald-600' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', color: 'from-violet-500 to-violet-600' },
];

export default function BalanceCards({ profile }) {
  const balances = {
    ILS: profile?.balance_ils || 0,
    USD: profile?.balance_usd || 0,
    EUR: profile?.balance_eur || 0,
  };

  if (!profile?.account_active) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {currencies.map((cur, i) => (
        <motion.div
          key={cur.code}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${cur.color} p-5 text-white shadow-lg`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{cur.flag}</span>
            <span className="text-sm font-medium opacity-90">{cur.code} Balance</span>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {cur.symbol}{balances[cur.code].toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs opacity-75">
            <Wallet className="w-3 h-3" />
            <span>Available</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}