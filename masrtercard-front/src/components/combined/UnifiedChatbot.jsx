import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Maximize2, Minimize2, PanelRight,
  CreditCard, BarChart3, Settings, History,
  Sparkles, Users, FileText, PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentFlow4 from '@/components/payment4/PaymentFlow4';
import PaymentsTab from '@/components/payment/chatbot-tabs/PaymentsTab';
import ReportsTab from '@/components/payment/chatbot-tabs/ReportsTab';
import AIChatTab from '@/components/payment/chatbot-tabs/AIChatTab';
import CardsList from '@/components/cards/chatbot-tabs/CardsList';
import CardCreationFlow from '@/components/cards/chatbot-tabs/CardCreationFlow';
import CardSystemSettings from '@/components/cards/chatbot-tabs/CardSystemSettings';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';

const TABS = [
  { id: 'pay', label: 'Pay', icon: CreditCard, section: 'invoices' },
  { id: 'payments', label: 'History', icon: History, section: 'invoices' },
  { id: 'reports', label: 'Reports', icon: BarChart3, section: 'invoices' },
  { id: 'cards', label: 'Cards', icon: Users, section: 'cards' },
  { id: 'new_card', label: 'New Card', icon: PlusCircle, section: 'cards' },
  { id: 'system', label: 'Settings', icon: Settings, section: 'cards' },
  { id: 'ai', label: 'AI Chat', icon: Sparkles, section: 'ai' },
];

const VIEW_WIDTHS = {
  chat: 'w-[400px] max-w-full',
  half: 'w-1/2 max-w-full',
  full: 'w-full',
};

export default function UnifiedChatbot({ invoices = [], onClose, onComplete, profile, employees = [], defaultTab = 'pay' }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState(isMobile ? 'full' : 'half');
  const [activeTab, setActiveTab] = useState(invoices?.length > 0 ? 'pay' : defaultTab);
  const queryClient = useQueryClient();

  const { data: cards = [] } = useQuery({
    queryKey: ['virtual_cards'],
    queryFn: () => api.entities.VirtualCard.list('-created_date', 200),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['virtual_cards'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const invoiceSection = TABS.filter(t => t.section === 'invoices');
  const cardSection = TABS.filter(t => t.section === 'cards');
  const aiSection = TABS.filter(t => t.section === 'ai');

  const renderContent = () => {
    switch (activeTab) {
      case 'pay':
        return invoices?.length > 0
          ? <PaymentFlow4 invoices={invoices} onClose={onClose} onComplete={onComplete} profile={profile} entityName="Invoice4" />
          : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm mb-1">No invoices selected</p>
              <p className="text-xs text-muted-foreground">Select invoices from the table to start a payment</p>
            </div>
          );
      case 'payments':
        return <PaymentsTab entityName="Invoice4" />;
      case 'reports':
        return <ReportsTab entityName="Invoice4" />;
      case 'cards':
        return <CardsList cards={cards} employees={employees} selectedEmployee={null} onSelectEmployee={() => {}} onCreateCard={() => setActiveTab('new_card')} onRefresh={refresh} />;
      case 'new_card':
        return <CardCreationFlow employees={employees} preselectedEmployee={null} onCreated={() => { refresh(); setActiveTab('cards'); }} />;
      case 'system':
        return <CardSystemSettings />;
      case 'ai':
        return <AIChatTab />;
      default:
        return null;
    }
  };

  return createPortal(
    <AnimatePresence>
      {viewMode === 'full' && (
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-gradient-to-r from-primary/5 to-rose-500/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-xs leading-none">XBS</span>
            </div>
            <div>
              <h3 className="text-sm font-bold">Unified Finance Hub</h3>
              <p className="text-[10px] text-muted-foreground">Invoices & Cards · XBS</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${viewMode === 'chat' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('chat')}>
              <PanelRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${viewMode === 'half' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('half')}>
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${viewMode === 'full' ? 'text-primary bg-primary/10' : ''}`} onClick={() => setViewMode('full')}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Section labels + Tabs */}
        <div className="shrink-0 border-b border-border bg-muted/20">
          {/* Section headers */}
          <div className="flex text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-2 pt-2">
            <div className="flex-[3] text-center border-r border-border pr-1 pb-1">💳 Invoice Payments</div>
            <div className="flex-[3] text-center border-r border-border px-1 pb-1">👤 Card Management</div>
            <div className="flex-[1] text-center pl-1 pb-1">🤖 AI</div>
          </div>
          <div className="flex border-t border-border">
            {invoiceSection.map(tab => (
              <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={setActiveTab} accent="rose" />
            ))}
            <div className="w-px bg-border shrink-0" />
            {cardSection.map(tab => (
              <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={setActiveTab} accent="blue" />
            ))}
            <div className="w-px bg-border shrink-0" />
            {aiSection.map(tab => (
              <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={setActiveTab} accent="violet" />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function TabButton({ tab, active, onClick, accent }) {
  const accentClasses = {
    rose: 'border-rose-500 text-rose-600 bg-rose-50',
    blue: 'border-blue-500 text-blue-600 bg-blue-50',
    violet: 'border-violet-500 text-violet-600 bg-violet-50',
  };
  return (
    <button
      onClick={() => onClick(tab.id)}
      className={`flex-1 flex items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-all border-b-2 ${
        active ? accentClasses[accent] : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <tab.icon className="w-3 h-3" />
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  );
}