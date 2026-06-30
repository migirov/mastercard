import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Save, Loader2 } from 'lucide-react';

const MCC_CATEGORIES = [
  'restaurants', 'supermarkets', 'fuel', 'travel', 'software',
  'hardware', 'entertainment', 'health', 'education', 'other'
];

export default function CardLimitsModal({ card, onClose, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [limits, setLimits] = useState({
    monthly_limit: card.monthly_limit || 0,
    single_transaction_limit: card.single_transaction_limit || 0,
    allowed_categories: card.allowed_categories || [],
    blocked_categories: card.blocked_categories || [],
  });

  const toggleCategory = (cat, field) => {
    const arr = limits[field] || [];
    setLimits(l => ({
      ...l,
      [field]: arr.includes(cat) ? arr.filter(x => x !== cat) : [...arr, cat]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.entities.VirtualCard.update(card.id, limits);
      onSaved?.();
      onClose();
    } catch {
      /* ignore in the demo */
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-h-[90vh] bg-card rounded-t-2xl border-t border-border shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <h3 className="font-bold text-sm">עריכת לימיטים והגבלות</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Card info */}
          <Card className="p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">כרטיס</p>
            <p className="font-semibold text-sm">{card.card_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.employee_name}</p>
          </Card>

          {/* Spending limits */}
          <Card className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">לימיטי הוצאה</h4>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">לימיט חודשי (₪)</label>
              <Input
                type="number"
                min="0"
                placeholder="0 = ללא הגבלה"
                value={limits.monthly_limit || ''}
                onChange={e => setLimits(l => ({ ...l, monthly_limit: Number(e.target.value) }))}
                className="text-sm h-9 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">לימיט לעסקה בודדת (₪)</label>
              <Input
                type="number"
                min="0"
                placeholder="0 = ללא הגבלה"
                value={limits.single_transaction_limit || ''}
                onChange={e => setLimits(l => ({ ...l, single_transaction_limit: Number(e.target.value) }))}
                className="text-sm h-9 font-mono"
              />
            </div>
          </Card>

          {/* Allowed categories */}
          <Card className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">קטגוריות מותרות</h4>
            <p className="text-xs text-muted-foreground">בחר קטגוריות MCC להן רשאי הכרטיס</p>
            <div className="flex gap-1.5 flex-wrap">
              {MCC_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat, 'allowed_categories')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all capitalize ${
                    limits.allowed_categories.includes(cat)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Card>

          {/* Blocked categories */}
          <Card className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">קטגוריות חסומות</h4>
            <p className="text-xs text-muted-foreground">בחר קטגוריות MCC שחסומות לכרטיס</p>
            <div className="flex gap-1.5 flex-wrap">
              {MCC_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat, 'blocked_categories')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all capitalize ${
                    limits.blocked_categories.includes(cat)
                      ? 'bg-destructive text-white border-destructive'
                      : 'bg-background text-muted-foreground border-border hover:border-destructive/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-2 sticky bottom-0 pt-4 border-t border-border bg-card">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
              ביטול
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isSaving ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}