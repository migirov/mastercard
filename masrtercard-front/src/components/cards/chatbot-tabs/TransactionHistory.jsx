import React, { useState } from 'react';
import { format } from 'date-fns';
import { Search, TrendingUp, ArrowDownLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';

const CAT_ICONS = {
  restaurants: '🍽️', supermarkets: '🛒', fuel: '⛽', travel: '✈️',
  software: '💻', hardware: '🖥️', entertainment: '🎬', health: '💊',
  education: '📚', other: '📦'
};

const STATUS_STYLES = {
  approved: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  pending: 'bg-yellow-50 text-yellow-700',
};

export default function TransactionHistory({ transactions, cards, selectedEmployee }) {
  const [search, setSearch] = useState('');
  const [filterCard, setFilterCard] = useState('all');

  const relevant = selectedEmployee
    ? transactions.filter(t => t.employee_id === selectedEmployee.id)
    : transactions;

  const empCards = selectedEmployee
    ? cards.filter(c => c.employee_id === selectedEmployee.id)
    : cards;

  const filtered = relevant.filter(t => {
    const matchSearch = !search ||
      t.merchant_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.card_name?.toLowerCase().includes(search.toLowerCase());
    const matchCard = filterCard === 'all' || t.card_id === filterCard;
    return matchSearch && matchCard;
  });

  const totalSpent = filtered.filter(t => t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        {empCards.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            <button onClick={() => setFilterCard('all')}
              className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap font-medium transition-colors ${filterCard === 'all' ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'}`}>
              All cards
            </button>
            {empCards.map(c => (
              <button key={c.id} onClick={() => setFilterCard(c.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap font-medium transition-colors ${filterCard === c.id ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'}`}>
                {c.card_name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{filtered.length} transactions</span>
          </div>
          <div className="font-semibold text-foreground">
            ₪{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <ArrowDownLeft className="w-8 h-8 opacity-30" />
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                  {CAT_ICONS[tx.merchant_category] || '💳'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{tx.merchant_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground capitalize">{tx.merchant_category || 'other'}</span>
                    {tx.card_name && <span className="text-[10px] text-muted-foreground">· {tx.card_name}</span>}
                    {!selectedEmployee && tx.employee_name && <span className="text-[10px] text-muted-foreground">· {tx.employee_name}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm tabular-nums">₪{tx.amount?.toLocaleString()}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[tx.status]}`}>
                      {tx.status}
                    </span>
                    {tx.transaction_date && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(tx.transaction_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}