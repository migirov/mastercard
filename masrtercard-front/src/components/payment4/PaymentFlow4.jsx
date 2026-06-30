import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import InvoiceReviewStep from '@/components/payment/steps/InvoiceReviewStep';
import ChatMessage from '@/components/payment/ChatMessage';
import { CheckCircle2, Clock, Users } from 'lucide-react';

const STEPS = ['review', 'approval_submitted'];

export default function PaymentFlow4({ invoices, onClose, onComplete, profile, entityName = 'Invoice4' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [reviewedInvoices, setReviewedInvoices] = useState(
    invoices.map(inv => ({
      ...inv,
      payment_currency: inv.currency,
      payment_amount: inv.amount,
      fx_rate: inv.currency === 'USD' ? 3.618 : inv.currency === 'EUR' ? 4.098 : 1,
      beneficiary_account: inv.beneficiary_account || '',
      beneficiary_address: inv.beneficiary_address || '',
      iban_validated: false,
      address_validated: false,
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `I'll help you process ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}. Please review the details, confirm FX rates, and send for manager approval.` },
  ]);

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app_users'],
    queryFn: () => api.entities.AppUser.list(),
  });

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const handleReviewProceed = async (notesToApprover) => {
    setSubmitting(true);
    const manager = appUsers.find(u => u.role === 'manager') || appUsers.find(u => u.role === 'admin');

    const totalUsd = reviewedInvoices.reduce((sum, inv) => {
      const rate = inv.payment_currency === 'USD' ? 1 : inv.payment_currency === 'ILS' ? 1 / 3.618 : inv.payment_currency === 'EUR' ? 4.098 / 3.618 : 1;
      return sum + (inv.payment_amount || inv.amount) * rate;
    }, 0);

    // Create PaymentApproval record
    await api.entities.PaymentApproval.create({
      requester_id: 'current_user',
      requester_name: 'Current User',
      approver_id: manager?.id || 'manager',
      approver_name: manager?.full_name || 'Manager',
      invoice_ids: reviewedInvoices.map(inv => inv.id),
      entity_name: entityName,
      total_amount_usd: parseFloat(totalUsd.toFixed(2)),
      status: 'pending',
      notes_to_approver: notesToApprover || '',
      invoice_details: reviewedInvoices.map(inv => ({
        invoice_number: inv.invoice_number,
        supplier_name: inv.supplier_name,
        amount: inv.amount,
        currency: inv.currency,
        payment_amount: inv.payment_amount || inv.amount,
        payment_currency: inv.payment_currency || inv.currency,
        fx_rate: inv.fx_rate || 1,
      })),
      fx_quote_data: reviewedInvoices.map(inv => ({
        invoice_id: inv.id,
        payment_currency: inv.payment_currency || inv.currency,
        fx_rate: inv.fx_rate || 1,
        payment_amount: inv.payment_amount || inv.amount,
      })),
    });

    // Update all invoices to awaiting_approval
    for (const inv of reviewedInvoices) {
      await api.entities[entityName].update(inv.id, {
        status: 'awaiting_approval',
        payment_currency: inv.payment_currency || inv.currency,
        payment_amount: inv.payment_amount || inv.amount,
        fx_rate: inv.fx_rate || 1,
        beneficiary_account: inv.beneficiary_account || '',
        beneficiary_address: inv.beneficiary_address || '',
      });
    }

    addMessage({ role: 'user', content: 'All details confirmed. Sending for approval.' });
    addMessage({ role: 'assistant', content: `Payment request sent to ${manager?.full_name || 'your manager'} for approval. You'll be notified once reviewed.` });
    setSubmitting(false);
    setCurrentStep(1);
  };

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'review':
        return (
          <InvoiceReviewStep
            invoices={reviewedInvoices}
            onUpdate={setReviewedInvoices}
            onProceed={handleReviewProceed}
            profile={profile}
          />
        );
      case 'approval_submitted':
        return (
          <div className="flex flex-col items-center text-center gap-5 py-6 px-4">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Awaiting Approval</h3>
              <p className="text-sm text-muted-foreground">
                Your payment request for <strong>{reviewedInvoices.length} invoice{reviewedInvoices.length !== 1 ? 's' : ''}</strong> has been sent for manager approval.
              </p>
            </div>
            <div className="w-full rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-left">
              {reviewedInvoices.map((inv, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-medium">{inv.supplier_name}</span>
                  <span className="text-muted-foreground">
                    {inv.payment_currency} {(inv.payment_amount || inv.amount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>Manager approval required — check Approvals tab for status updates</span>
            </div>
            <Button className="w-full" onClick={onClose}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Done
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-4">
        {messages.map((msg, i) => <ChatMessage key={i} role={msg.role} content={msg.content} />)}

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                i <= currentStep ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 w-8 ${i < currentStep ? 'bg-rose-600' : 'bg-border'}`} />}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {STEPS[currentStep] === 'review' ? 'Review & Submit' : 'Approval Sent'}
          </span>
        </div>

        {submitting ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Submitting approval request...</p>
          </div>
        ) : renderStep()}
      </div>
    </ScrollArea>
  );
}