import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Building2, CreditCard, Globe } from 'lucide-react';

export default function RecipientsTab() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices_recipients'],
    queryFn: () => api.entities.Invoice.list('-created_date', 200),
  });

  // Deduplicate recipients by supplier_name
  const recipientsMap = {};
  for (const inv of invoices) {
    if (!inv.supplier_name) continue;
    if (!recipientsMap[inv.supplier_name]) {
      recipientsMap[inv.supplier_name] = {
        name: inv.supplier_name,
        account: inv.beneficiary_account || '',
        address: inv.beneficiary_address || '',
        currencies: new Set(),
        invoiceCount: 0,
      };
    }
    if (inv.currency) recipientsMap[inv.supplier_name].currencies.add(inv.currency);
    recipientsMap[inv.supplier_name].invoiceCount++;
  }
  const recipients = Object.values(recipientsMap);

  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading...</div>;
  }

  if (recipients.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
        <Building2 className="w-8 h-8 opacity-30" />
        <p className="text-sm">No recipient data found yet.</p>
        <p className="text-xs">Recipients are recorded from invoice payments.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 overflow-y-auto h-full">
      {recipients.map(r => (
        <div key={r.name} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">{r.invoiceCount} invoice{r.invoiceCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-1">
              {[...r.currencies].map(c => (
                <span key={c} className="text-[9px] font-bold bg-primary/10 text-primary rounded px-1.5 py-0.5">{c}</span>
              ))}
            </div>
          </div>
          {r.account && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CreditCard className="w-3 h-3 shrink-0" />
              <span className="truncate">{r.account}</span>
            </div>
          )}
          {r.address && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate">{r.address}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}