import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Building2, ChevronLeft, ChevronRight, FlaskConical, Files, BookOpen, CreditCard, Sparkles, Landmark, Hash, MapPin, TrendingUp, BookMarked, FileCheck, Activity, MessageSquareWarning } from 'lucide-react';

const navItems = [
  { icon: FileText, label: 'Invoices (Altshuler Shaham)', path: '/' },
  { icon: Files, label: 'Invoices (Onboarding – Altshuler Shaham)', path: '/dashboard3' },
  { icon: CreditCard, label: 'Employees or Team', path: '/cards' },
  { icon: Sparkles, label: 'Invoices & Employees', path: '/invoices-employees' },
  { icon: FlaskConical, label: 'Tests', path: '/test' },
  { icon: BookOpen, label: 'Integration Docs', path: '/integration-docs' },
];

// Mastercard cross-border APIs surfaced as standalone tools. `live` ones return real
// Mastercard sandbox data; the rest are demo until Mastercard enables them (env-switchable).
const featureItems = [
  { icon: Landmark, label: 'Bank Lookup', path: '/features/bank-lookup', live: true },
  { icon: Hash, label: 'IBAN Generator', path: '/features/iban', live: true },
  { icon: MapPin, label: 'Cash Pickup', path: '/features/cash-pickup', live: true },
  { icon: TrendingUp, label: 'FX Rates', path: '/features/rates' },
  { icon: BookMarked, label: 'Endpoint Guide', path: '/features/endpoint-guide' },
  { icon: FileCheck, label: 'Quote Lifecycle', path: '/features/quote-lifecycle' },
  { icon: Activity, label: 'Payment Tracker', path: '/features/payment-tracker' },
  { icon: MessageSquareWarning, label: 'RFI Center', path: '/features/rfi' },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`p-4 border-b border-sidebar-border flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">Moras LTD</h1>
              <p className="text-[11px] text-sidebar-foreground/50">Best management solutions</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground ${collapsed ? 'mt-2' : ''}`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Features — standalone Mastercard cross-border tools */}
        <div className="pt-3 mt-2 border-t border-sidebar-border/60 space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Features
            </p>
          )}
          {featureItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && item.live && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Live Mastercard data" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={`p-4 border-t border-sidebar-border ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-3 px-1 py-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold shrink-0">
            ML
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Moras LTD</p>
              <p className="text-[10px] text-sidebar-foreground/40">Accounts Payable</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}