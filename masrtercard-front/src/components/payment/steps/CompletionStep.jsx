import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CompletionStep({ invoices, onDone }) {
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setProcessing(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (processing) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
        <p className="font-bold text-lg">Processing payments...</p>
        <p className="text-sm text-muted-foreground mt-1">This may take a few moments</p>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <Card className="p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3"
        >
          <CheckCircle2 className="w-7 h-7 text-accent" />
        </motion.div>
        <h3 className="text-xl font-bold mb-1">Payments submitted!</h3>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} are now being processed
        </p>
      </Card>

      {/* Batch summary */}
      <Card className="overflow-hidden">
        <div className="p-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Batch Summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-y border-border">
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Invoice #</th>
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Due Date</th>
                <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Amount Paid</th>
                <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Cost</th>
                <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const sym = inv.payment_currency === 'ILS' ? '₪' : inv.payment_currency === 'USD' ? '$' : '€';
                const cost = inv.transaction_cost ? `$${inv.transaction_cost}` : (inv.currency !== 'ILS' ? '$3' : '$2');
                return (
                  <motion.tr
                    key={inv.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{inv.supplier_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {sym}{(inv.payment_amount || inv.amount)?.toLocaleString()}
                      {inv.payment_currency && inv.payment_currency !== inv.currency && (
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">{inv.payment_currency}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{cost}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Button onClick={onDone} className="w-full font-semibold">
        Return to dashboard
      </Button>
    </motion.div>
  );
}