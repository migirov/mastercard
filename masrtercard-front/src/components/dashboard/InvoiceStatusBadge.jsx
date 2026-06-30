import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  unpaid: { label: 'Unpaid', className: 'bg-muted text-muted-foreground border-border' },
  pending: { label: 'Pending', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-200' },
  rfi: { label: 'RFI', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  partially_paid: { label: 'Partially Paid', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  awaiting_approval: { label: 'Awaiting Approval', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  not_approved: { label: 'Not Approved', className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function InvoiceStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.unpaid;
  return (
    <Badge variant="outline" className={`${config.className} text-[11px] font-semibold border px-2.5 py-0.5`}>
      {config.label}
    </Badge>
  );
}