import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, PanelRight, CreditCard, BarChart3, Settings, History, BookOpen, Sparkles, CheckCircle2, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentFlow3 from './PaymentFlow3';
import InvoiceDetailView3 from './InvoiceDetailView3';
import PaymentsTab from '@/components/payment/chatbot-tabs/PaymentsTab';
import ReportsTab from '@/components/payment/chatbot-tabs/ReportsTab';
import KnowledgeBaseTab from '@/components/payment/chatbot-tabs/KnowledgeBaseTab';
import AIChatTab from '@/components/payment/chatbot-tabs/AIChatTab';
import SettingsTab3 from './SettingsTab3';
import { BankOnboardingInline3 } from '@/components/onboarding/BankOnboarding3';

const TABS = [
  { id: 'pay', label: 'Pay', icon: CreditCard },
  { id: 'payments', label: 'Payments', icon: History },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'knowledge', label: 'Help', icon: BookOpen },
  { id: 'ai', label: 'AI Chat', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const VIEW_WIDTHS = {
  chat: 'w-[400px] max-w-full',
  half: 'w-1/2 max-w-full',
  full: 'w-full',
};

function WelcomeState3({ profile }) {
  const balances = [
    { code: 'ILS', symbol: '₪', flag: '🇮🇱', amount: profile?.balance_ils || 0 },
    { code: 'USD', symbol: '$', flag: '🇺🇸', amount: profile?.balance_usd || 0 },
    { code: 'EUR', symbol: '€', flag: '🇪🇺', amount: profile?.balance_eur || 0 },
  ];
  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 space-y-5">
      <div className="text-center pt-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-bold text-lg">Your account is active!</h3>
        <p className="text-sm text-muted-foreground mt-1">Cross-border payments are enabled. Select invoices from the table to get started.</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Available Balances</p>
        <div className="grid grid-cols-3 gap-2">
          {balances.map(b => (
            <div key={b.code} className="p-3 rounded-xl bg-muted/50 border border-border text-center">
              <span className="text-xl">{b.flag}</span>
              <p className="text-[10px] text-muted-foreground mt-1">{b.code}</p>
              <p className="font-bold text-sm">{b.symbol}{b.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What you can do</p>
        <div className="space-y-2">
          {[
            { icon: CreditCard, title: 'Pay invoices', desc: 'Select invoices from the table and pay in ILS, USD or EUR' },
            { icon: Globe, title: 'Cross-border payments', desc: 'Send USD/EUR directly to international suppliers' },
            { icon: BarChart3, title: 'Track payments', desc: 'Monitor all transactions in real-time under Payments tab' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground pb-4 flex items-center justify-center gap-1">
        <ArrowRight className="w-3 h-3" /> Select invoices from the table on the left to begin
      </p>
    </div>
  );
}

export default function PaymentChatbot3({ invoices, onClose, onComplete, profile, defaultTab = 'pay', onOnboardingComplete }) {
  const needsOnboarding = !profile?.kyb_verified || !profile?.account_active;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState(isMobile ? 'full' : 'half');
  const singleInvoice = invoices?.length === 1 ? invoices[0] : null;
  const isNonPayable = singleInvoice && !['unpaid', 'rfi', 'partially_paid'].includes(singleInvoice.status);
  const [activeTab, setActiveTab] = useState(invoices?.length > 0 ? 'pay' : defaultTab);
  const [onboardingDone, setOnboardingDone] = useState(!needsOnboarding);
  const isFullscreen = viewMode === 'full';

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pay':
        if (!onboardingDone) {
          return (
            <BankOnboardingInline3 onComplete={() => {
              setOnboardingDone(true);
              setActiveTab('payments');
              if (onOnboardingComplete) onOnboardingComplete();
            }} />
          );
        }
        if (isNonPayable) {
          return <InvoiceDetailView3 invoice={singleInvoice} isKybVerified={!needsOnboarding} onPay={(inv) => { onClose(); }} />;
        }
        return invoices?.length > 0
          ? <PaymentFlow3 invoices={invoices} onClose={onClose} onComplete={onComplete} profile={profile} />
          : <WelcomeState3 profile={profile} />;
      case 'payments':
        return <PaymentsTab entityName="Invoice3" />;
      case 'reports':
        return <ReportsTab entityName="Invoice3" />;
      case 'knowledge':
        return <KnowledgeBaseTab />;
      case 'ai':
        return <AIChatTab />;
      case 'settings':
        return <SettingsTab3 />;
      default:
        return null;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isFullscreen && (
        <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <motion.div
        key="panel"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ top: 0, right: 0, bottom: 0, position: 'fixed' }}
        className={`z-50 bg-card shadow-2xl border-l border-border flex flex-col ${VIEW_WIDTHS[viewMode]}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-border overflow-hidden flex items-center justify-center p-0.5 shadow-sm">
              <img
                src="/partner-logo.svg"
                alt="Altshuler Shaham"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-sm font-bold">Embedded XBS <span className="text-muted-foreground font-normal text-xs ml-1">Altshuler Shaham</span></h3>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${viewMode === 'chat' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('chat')} title="Chat panel">
              <PanelRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${viewMode === 'half' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('half')} title="Half screen">
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${viewMode === 'full' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('full')} title="Full screen">
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 bg-muted/30">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-all border-b-2 ${
                  isActive ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden">
          {renderTabContent()}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}