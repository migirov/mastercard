import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Building2, FileText, FileStack, Files, Landmark, FlaskConical, BookOpen, Hash, MapPin, TrendingUp, BookMarked, FileCheck, Activity, MessageSquareWarning } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { icon: FileText, label: 'Invoices (Altshuler Shaham)', path: '/' },
  { icon: FileStack, label: 'Invoices (Anonymous Partner)', path: '/dashboard2' },
  { icon: Files, label: 'Invoices (Onboarding – Altshuler Shaham)', path: '/dashboard3' },
  { icon: Landmark, label: 'Invoices (Bank X – TopUp)', path: '/dashboard4' },
  { icon: FlaskConical, label: 'Tests', path: '/test' },
  { icon: BookOpen, label: 'Integration Docs', path: '/integration-docs' },
];

const featureItems = [
  { icon: Landmark, label: 'Bank Lookup', path: '/features/bank-lookup' },
  { icon: Hash, label: 'IBAN Generator', path: '/features/iban' },
  { icon: MapPin, label: 'Cash Pickup', path: '/features/cash-pickup' },
  { icon: TrendingUp, label: 'FX Rates', path: '/features/rates' },
  { icon: BookMarked, label: 'Endpoint Guide', path: '/features/endpoint-guide' },
  { icon: FileCheck, label: 'Quote Lifecycle', path: '/features/quote-lifecycle' },
  { icon: Activity, label: 'Payment Tracker', path: '/features/payment-tracker' },
  { icon: MessageSquareWarning, label: 'RFI Center', path: '/features/rfi' },
];

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Building2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm">Moras LTD</span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-2 hover:bg-muted rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-sm">Moras LTD</h1>
                <p className="text-[11px] text-sidebar-foreground/50">Best management solutions</p>
              </div>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              );
            })}

            <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Features
            </p>
            {featureItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}