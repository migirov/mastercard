import React, { useState } from 'react';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { CreditCard, Snowflake, Trash2, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CardLimitsModal from './CardLimitsModal';

const PURPOSE_ICONS = {
  spend: '💳', salary: '💰', travel: '✈️', meals: '🍽️',
  software: '💻', hardware: '🖥️', marketing: '📢', other: '📦'
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  frozen: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function CardsList({ cards, employees, selectedEmployee, onSelectEmployee, onCreateCard, onRefresh }) {
  const [loading, setLoading] = useState({});
  const [editingCard, setEditingCard] = useState(null);

  const filtered = selectedEmployee
    ? cards.filter(c => c.employee_id === selectedEmployee.id)
    : cards;

  const toggleFreeze = async (card) => {
    setLoading(l => ({ ...l, [card.id]: true }));
    try {
      await api.entities.VirtualCard.update(card.id, {
        status: card.status === 'active' ? 'frozen' : 'active'
      });
      onRefresh();
    } catch {
      /* surface nothing in the demo; just release the button */
    } finally {
      setLoading(l => ({ ...l, [card.id]: false }));
    }
  };

  const cancelCard = async (card) => {
    if (!confirm('Cancel this virtual card? This cannot be undone.')) return;
    setLoading(l => ({ ...l, [card.id]: true }));
    try {
      await api.entities.VirtualCard.update(card.id, { status: 'cancelled' });
      onRefresh();
    } catch {
      /* ignore in the demo */
    } finally {
      setLoading(l => ({ ...l, [card.id]: false }));
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-5">
        <CreditCard className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm font-medium">No cards yet</p>
        <p className="text-xs text-muted-foreground">Create a virtual Mastercard for an employee</p>
        <Button size="sm" onClick={onCreateCard} className="gap-1.5 mt-1">
          <Plus className="w-4 h-4" /> Create First Card
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {!selectedEmployee && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{filtered.length} cards total</p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCreateCard}>
            <Plus className="w-3.5 h-3.5" /> New Card
          </Button>
        </div>
      )}
      <AnimatePresence>
        {filtered.map(card => {
          const usagePct = card.monthly_limit > 0
            ? Math.min(100, (card.total_spent_this_month / card.monthly_limit) * 100)
            : 0;
          return (
            <motion.div key={card.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`rounded-xl border p-4 ${card.status === 'cancelled' ? 'opacity-40' : ''}`}>
              {/* Card visual mini */}
              <div className={`rounded-xl p-3.5 mb-3 text-white relative overflow-hidden ${
                card.status === 'frozen'
                  ? 'bg-gradient-to-br from-slate-500 to-slate-700'
                  : 'bg-gradient-to-br from-primary to-primary/70'
              }`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-base mr-1">{PURPOSE_ICONS[card.purpose] || '💳'}</span>
                    <span className="font-semibold text-sm">{card.card_name}</span>
                  </div>
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-red-400 opacity-90" />
                    <div className="w-5 h-5 rounded-full bg-yellow-400 opacity-90" />
                  </div>
                </div>
                <p className="font-mono text-xs tracking-widest opacity-70">•••• •••• •••• {card.last4 || '••••'}</p>
                <div className="flex justify-between mt-2">
                  <div>
                    <p className="text-[9px] opacity-50">CARDHOLDER</p>
                    <p className="text-[11px] font-medium">{card.employee_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] opacity-50">EXPIRES</p>
                    <p className="text-[11px] font-mono">{card.expiry || '••/••'}</p>
                  </div>
                </div>
                {card.status === 'frozen' && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <Snowflake className="w-3.5 h-3.5" /> FROZEN
                    </div>
                  </div>
                )}
              </div>

              {/* Spending progress */}
              {card.monthly_limit > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Spent this month</span>
                    <span className="font-medium">₪{(card.total_spent_this_month || 0).toLocaleString()} / ₪{card.monthly_limit.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${usagePct}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[card.status]}`}>
                  {card.status}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">· {card.purpose}</span>
                {card.allowed_categories?.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">· {card.allowed_categories.slice(0,2).join(', ')}{card.allowed_categories.length > 2 ? '...' : ''}</span>
                )}
                <div className="ml-auto flex gap-1">
                  {card.status !== 'cancelled' && (
                    <>
                      <button onClick={() => setEditingCard(card)} disabled={loading[card.id]}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit limits">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleFreeze(card)} disabled={loading[card.id]}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}>
                        <Snowflake className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => cancelCard(card)} disabled={loading[card.id]}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        title="Cancel card">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {editingCard && (
        <CardLimitsModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}