import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Globe, Shield, Zap, DollarSign, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    category: 'General',
    icon: HelpCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    questions: [
      {
        q: 'What is XBS Embedded?',
        a: 'XBS Embedded is a cross-border payment service integrated directly into your ERP system. It lets you pay international suppliers directly from your invoice management system, without needing to access an external platform.',
      },
      {
        q: 'Who is this service for?',
        a: 'Any business that pays international suppliers — importers, tech companies, SMEs that regularly need to make foreign currency transfers.',
      },
    ],
  },
  {
    category: 'Payments',
    icon: Globe,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    questions: [
      {
        q: 'Which countries can I pay to?',
        a: 'You can send payments to 180+ countries worldwide, including the US, Europe, Asia and more. The system supports ILS, USD and EUR as payment currencies.',
      },
      {
        q: 'How long does payment processing take?',
        a: 'Payments are typically processed within 1–3 business days, depending on the destination and currency. SEPA payments within Europe usually complete within one business day.',
      },
      {
        q: 'What if I sent an incorrect payment?',
        a: 'You can cancel a payment while it is in "Pending" status before it is processed. After processing, please contact our support team. That\'s why it\'s important to verify beneficiary details before confirming.',
      },
    ],
  },
  {
    category: 'Costs & FX Rates',
    icon: DollarSign,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    questions: [
      {
        q: 'What is the cost per transaction?',
        a: 'Transaction fees vary by transfer size and destination. Typically between ₪15–50 per transaction — significantly lower than traditional bank fees.',
      },
      {
        q: 'How is the exchange rate determined?',
        a: 'Exchange rates are updated in real time via the Mastercard FX API. You see the exact rate before confirming each payment — no surprises.',
      },
    ],
  },
  {
    category: 'Security & Compliance',
    icon: Shield,
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    questions: [
      {
        q: 'Is my money secure?',
        a: 'Yes. The service operates in partnership with Altshuler Shaham, a financial institution regulated by the Bank of Israel. All transfers are encrypted and secured to full banking standards.',
      },
      {
        q: 'What is KYB and why is it required?',
        a: 'KYB (Know Your Business) is a legally required business identity verification process. It protects your business and beneficiaries and ensures compliance with Israeli and international financial regulations.',
      },
    ],
  },
  {
    category: 'How to Use',
    icon: Zap,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    questions: [
      {
        q: 'How do I get started?',
        a: '1. Click the XBS button in the bottom-right corner\n2. Complete a short registration (KYB)\n3. Select invoices to pay from the table\n4. Confirm and send — that\'s it!',
      },
      {
        q: 'What is RFI?',
        a: 'RFI (Request for Information) means additional information is needed to process the payment. The system will show exactly what is missing, and once provided, the payment will be processed automatically.',
      },
    ],
  },
];

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-lg border border-border overflow-hidden transition-all ${open ? 'bg-muted/30' : 'bg-card'}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <span className="text-sm font-medium">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-line leading-relaxed border-t border-border pt-3">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function KnowledgeBaseTab() {
  const [activeCategory, setActiveCategory] = useState(null);

  const filtered = activeCategory
    ? faqs.filter(f => f.category === activeCategory)
    : faqs;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold">Knowledge Base</h2>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              activeCategory === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            All
          </button>
          {faqs.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category === activeCategory ? null : cat.category)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  activeCategory === cat.category
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                <Icon className="w-3 h-3" />
                {cat.category}
              </button>
            );
          })}
        </div>

        {/* FAQ sections */}
        {filtered.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.category} className="space-y-2">
              <div className="flex items-center gap-2 pt-1">
                <div className={`w-6 h-6 rounded-md ${cat.bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                </div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.category}</h3>
              </div>
              <div className="space-y-2">
                {cat.questions.map((item, i) => (
                  <FAQItem key={i} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}