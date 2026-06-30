import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import InvoiceReviewStep from '@/components/payment/steps/InvoiceReviewStep';
import BatchOverviewStep from '@/components/payment/steps/BatchOverviewStep';
import FundingStep from '@/components/payment/steps/FundingStep';
import CompletionStep from '@/components/payment/steps/CompletionStep';
import ChatMessage from '@/components/payment/ChatMessage';

const STEPS = ['review', 'batch_overview', 'funding', 'completion'];

export default function PaymentFlow2({ invoices, onClose, onComplete, profile }) {
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
      account_validated: false,
      address_validated: false,
    }))
  );
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `I'll help you process ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}. Let's review each one to ensure all details are correct.` },
  ]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);
  const goNext = () => { if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1); };

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'review':
        return (
          <InvoiceReviewStep
            invoices={reviewedInvoices}
            onUpdate={setReviewedInvoices}
            onProceed={() => {
              addMessage({ role: 'user', content: 'All invoices reviewed. Proceed to payment.' });
              addMessage({ role: 'assistant', content: 'Here\'s your final payment summary. Review each item and confirm.' });
              goNext();
            }}
          />
        );
      case 'batch_overview':
        return (
          <BatchOverviewStep
            invoices={reviewedInvoices}
            onEdit={() => setCurrentStep(0)}
            onProceed={() => {
              addMessage({ role: 'user', content: 'Confirmed. Process payments.' });
              addMessage({ role: 'assistant', content: 'Let me check your account balances...' });
              goNext();
            }}
          />
        );
      case 'funding':
        return (
          <FundingStep
            invoices={reviewedInvoices}
            profile={profile}
            onProceed={() => {
              addMessage({ role: 'assistant', content: 'Your payments are being processed!' });
              goNext();
            }}
          />
        );
      case 'completion':
        return <CompletionStep invoices={reviewedInvoices} onDone={() => onComplete(reviewedInvoices)} />;
      default:
        return null;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i <= currentStep ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-indigo-600' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
        {renderStep()}
      </div>
    </ScrollArea>
  );
}