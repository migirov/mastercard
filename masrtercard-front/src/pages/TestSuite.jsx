import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const EXPECTED_STATUSES = ['completed', 'pending', 'rejected', 'rfi', 'unpaid', 'partially_paid'];

function TestResult({ name, passed, detail, warn, info }) {
  const [open, setOpen] = useState(false);
  const color = info ? 'border-blue-200 bg-blue-50' : warn ? 'border-yellow-300 bg-yellow-50' : passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';
  const textColor = info ? 'text-blue-800' : warn ? 'text-yellow-800' : passed ? 'text-green-800' : 'text-red-800';
  const Icon = info ? Info : warn ? AlertTriangle : passed ? CheckCircle2 : XCircle;
  const iconColor = info ? 'text-blue-600' : warn ? 'text-yellow-600' : passed ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`rounded-lg border p-3 cursor-pointer transition-all ${color}`} onClick={() => setOpen(o => !o)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
          <span className={`text-sm font-medium ${textColor}`}>{name}</span>
        </div>
        {detail && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
      </div>
      {open && detail && (
        <div className="mt-2 pl-6 text-xs text-muted-foreground whitespace-pre-wrap font-mono">{detail}</div>
      )}
    </div>
  );
}

function Section({ title, req, children, passed, total }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mt-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {req && <p className="text-[11px] text-muted-foreground mt-0.5">Req: {req}</p>}
        </div>
        {total !== undefined && (
          <Badge className={`text-xs ${passed === total ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {passed}/{total}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

export default function TestSuite() {
  const { data: invoices = [], isLoading: loadingInv, refetch } = useQuery({
    queryKey: ['invoices_test'],
    queryFn: () => api.entities.Invoice.list('-created_date'),
  });
  const { data: profiles = [], isLoading: loadingProfile } = useQuery({
    queryKey: ['company_profile_test'],
    queryFn: () => api.entities.CompanyProfile.list(),
  });

  const profile = profiles[0];
  const loading = loadingInv || loadingProfile;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const byStatus = {};
  invoices.forEach(inv => {
    if (!byStatus[inv.status]) byStatus[inv.status] = [];
    byStatus[inv.status].push(inv);
  });

  const completedInvoices = byStatus['completed'] || [];
  const pendingInvoices = byStatus['pending'] || [];
  const rfiInvoices = byStatus['rfi'] || [];
  const partialInvoices = byStatus['partially_paid'] || [];
  const rejectedInvoices = byStatus['rejected'] || [];
  const unpaidInvoices = byStatus['unpaid'] || [];

  // ── SECTION 1: Onboarding & Activation (Req §1-4) ──────────────────────────
  const s1 = [
    {
      name: 'Company profile exists',
      passed: !!profile,
      detail: profile ? `company_name: ${profile.company_name}\nonboarding_step: ${profile.onboarding_step}` : 'No CompanyProfile record found',
    },
    {
      name: 'KYB verification field exists and toggleable',
      passed: profile?.hasOwnProperty('kyb_verified'),
      detail: `kyb_verified = ${profile?.kyb_verified}`,
    },
    {
      name: 'Account activation field exists',
      passed: profile?.hasOwnProperty('account_active'),
      detail: `account_active = ${profile?.account_active}`,
    },
    {
      name: 'Onboarding step is "activated" (post-onboarding demo state)',
      passed: profile?.onboarding_step === 'activated',
      detail: `onboarding_step = ${profile?.onboarding_step}`,
    },
    {
      name: 'ILS balance = 330,000 (as per §4)',
      passed: profile?.balance_ils === 330000,
      detail: `balance_ils = ${profile?.balance_ils} (expected 330000)`,
    },
    {
      name: 'USD balance = 150,000 (as per §4)',
      passed: profile?.balance_usd === 150000,
      detail: `balance_usd = ${profile?.balance_usd} (expected 150000)`,
    },
    {
      name: 'EUR balance = 75,000 (as per §4)',
      passed: profile?.balance_eur === 75000,
      detail: `balance_eur = ${profile?.balance_eur} (expected 75000)`,
    },
  ];

  // ── SECTION 2: Invoice Table & Pay Now Buttons (Req §1, §5) ────────────────
  const s2 = [
    {
      name: 'At least 1 unpaid invoice exists (Pay now buttons visible)',
      passed: unpaidInvoices.length > 0,
      detail: `Unpaid invoices: ${unpaidInvoices.map(i => i.invoice_number).join(', ') || 'none'}`,
    },
    {
      name: 'Non-ILS invoices exist (cross-border highlighting, §5)',
      passed: invoices.some(i => i.currency !== 'ILS'),
      detail: `Non-ILS: ${invoices.filter(i => i.currency !== 'ILS').map(i => `${i.invoice_number}(${i.currency})`).join(', ') || 'none'}`,
    },
    {
      name: 'USD invoices present',
      passed: invoices.some(i => i.currency === 'USD'),
      detail: invoices.filter(i => i.currency === 'USD').map(i => `  • ${i.invoice_number} – ${i.supplier_name} $${i.amount}`).join('\n'),
    },
    {
      name: 'EUR invoices present',
      passed: invoices.some(i => i.currency === 'EUR'),
      detail: invoices.filter(i => i.currency === 'EUR').map(i => `  • ${i.invoice_number} – ${i.supplier_name} €${i.amount}`).join('\n'),
    },
    {
      name: 'ILS (local) invoices present',
      passed: invoices.some(i => i.currency === 'ILS'),
      detail: invoices.filter(i => i.currency === 'ILS').map(i => `  • ${i.invoice_number} – ${i.supplier_name} ₪${i.amount}`).join('\n'),
    },
    {
      name: 'All invoices have invoice_number, supplier_name, due_date, amount',
      passed: invoices.every(i => i.invoice_number && i.supplier_name && i.due_date && i.amount > 0),
      detail: invoices
        .filter(i => !i.invoice_number || !i.supplier_name || !i.due_date || !(i.amount > 0))
        .map(i => `  • ${i.invoice_number || i.id}: missing fields`)
        .join('\n') || 'All complete',
    },
  ];

  // ── SECTION 3: Invoice Review Step (Req §6) ─────────────────────────────────
  const paidProcessed = [...completedInvoices, ...pendingInvoices];
  const s3 = [
    {
      name: 'Processed invoices have beneficiary_account (IBAN)',
      passed: paidProcessed.length > 0 && paidProcessed.every(i => !!i.beneficiary_account),
      detail: paidProcessed.map(i => `  • ${i.invoice_number}: IBAN="${i.beneficiary_account || 'MISSING'}"`).join('\n') || 'No processed invoices',
    },
    {
      name: 'Processed invoices have beneficiary_address',
      passed: paidProcessed.length > 0 && paidProcessed.every(i => !!i.beneficiary_address),
      detail: paidProcessed.map(i => `  • ${i.invoice_number}: addr="${i.beneficiary_address || 'MISSING'}"`).join('\n') || 'No processed invoices',
    },
    {
      name: 'Processed invoices have payment_currency selected',
      passed: paidProcessed.length > 0 && paidProcessed.every(i => !!i.payment_currency),
      detail: paidProcessed.map(i => `  • ${i.invoice_number}: pay_currency=${i.payment_currency}`).join('\n'),
    },
    {
      name: 'Processed invoices have payment_amount (editable field saved)',
      passed: paidProcessed.length > 0 && paidProcessed.every(i => (i.payment_amount || 0) > 0),
      detail: paidProcessed.map(i => `  • ${i.invoice_number}: payment_amount=${i.payment_amount}`).join('\n'),
    },
    {
      name: 'Cross-border invoices have fx_rate (Mastercard FX API enrichment)',
      passed: paidProcessed.filter(i => i.payment_currency !== i.currency).every(i => (i.fx_rate || 0) > 0),
      detail: paidProcessed.filter(i => i.payment_currency !== i.currency)
        .map(i => `  • ${i.invoice_number}: ${i.currency}→${i.payment_currency} fx_rate=${i.fx_rate}`).join('\n') || 'No cross-currency processed',
    },
    {
      name: 'file_url field exists on Invoice schema (invoice document attachment)',
      info: true,
      passed: true,
      detail: 'file_url is defined in entities/Invoice.json\nInvoiceReviewStep shows "View Invoice Document" link when file_url is set',
    },
  ];

  // ── SECTION 4: Batch Overview (Req §7) ──────────────────────────────────────
  const s4 = [
    {
      name: 'BatchOverviewStep has: Invoice#, Supplier, Due Date, Invoice Amt, Payment Amt, Currency, FX Rate, Total',
      info: true,
      passed: true,
      detail: 'All 8 columns are present in BatchOverviewStep.jsx table header.\nEdit (Pencil) + Approve (CheckCircle) actions also present.',
    },
    {
      name: '"Proceed to payment" button exists in BatchOverviewStep (§7)',
      info: true,
      passed: true,
      detail: 'BatchOverviewStep renders a "Proceed to payment" button with ArrowRight icon.',
    },
    {
      name: 'FX Rate displayed correctly for cross-currency (not "—" for same currency)',
      passed: paidProcessed.some(i => i.payment_currency !== i.currency && (i.fx_rate || 0) > 0),
      detail: paidProcessed
        .filter(i => i.payment_currency !== i.currency)
        .map(i => `  • ${i.invoice_number}: fx=${i.fx_rate}`)
        .join('\n') || 'No cross-currency invoices in processed set',
    },
    {
      name: 'Total column = payment_amount (in payment currency)',
      info: true,
      passed: true,
      detail: 'BatchOverviewStep "Total" column shows payment_amount in payment_currency.\nThis represents the total amount the beneficiary receives.',
    },
  ];

  // ── SECTION 5: Funding / Balance Check (Req §8) ──────────────────────────────
  // Req §8: demo scenario totals ILS:80k, USD:50k, EUR:90k → gap of 15k EUR (balance is 75k)
  const totalPayable = { ILS: 0, USD: 0, EUR: 0 };
  invoices.filter(i => ['unpaid', 'rfi'].includes(i.status)).forEach(i => {
    const c = i.currency; totalPayable[c] = (totalPayable[c] || 0) + (i.amount || 0);
  });
  const eurGap = totalPayable.EUR > (profile?.balance_eur || 0) ? totalPayable.EUR - (profile?.balance_eur || 0) : 0;

  const s5 = [
    {
      name: 'Profile balances are positive for all 3 currencies',
      passed: (profile?.balance_ils || 0) > 0 && (profile?.balance_usd || 0) > 0 && (profile?.balance_eur || 0) > 0,
      detail: `ILS: ₪${(profile?.balance_ils || 0).toLocaleString()}\nUSD: $${(profile?.balance_usd || 0).toLocaleString()}\nEUR: €${(profile?.balance_eur || 0).toLocaleString()}`,
    },
    {
      name: '§8 Demo scenario: EUR invoices exceed balance → 15k gap (EUR:90k needed, 75k available)',
      passed: eurGap > 0,
      detail: `Unpaid EUR invoices total: €${totalPayable.EUR?.toLocaleString()}\nEUR balance: €${(profile?.balance_eur || 0).toLocaleString()}\nGap: €${eurGap.toLocaleString()}\n\n💡 To trigger this: ensure unpaid EUR invoices total > €75,000`,
    },
    {
      name: '"Sufficient balance" path: ILS invoices payable within balance',
      passed: totalPayable.ILS <= (profile?.balance_ils || 0),
      detail: `ILS payable: ₪${totalPayable.ILS?.toLocaleString()} / balance: ₪${(profile?.balance_ils || 0).toLocaleString()}`,
    },
    {
      name: 'Top-up options available: Request to Pay, MASAV, A2A (§8)',
      info: true,
      passed: true,
      detail: 'All 3 options are rendered in FundingStep.jsx:\n  • Request to Pay\n  • MASAV Payment (from within ISV)\n  • Account-to-Account Transfer (with Refresh button)',
    },
    {
      name: 'A2A option has Refresh button (§8)',
      info: true,
      passed: true,
      detail: 'RefreshCw icon button is rendered alongside A2A option in FundingStep.jsx',
    },
    {
      name: 'FundingStep shows per-currency breakdown before "Pay now" (§8)',
      info: true,
      passed: true,
      detail: 'FundingStep renders a grid showing required amount per currency.\nOn "Sufficient" path: shows ILS/USD/EUR payment cards.\nOn "Gap" path: shows gap amount and top-up options.',
    },
  ];

  // ── SECTION 6: Status Tracking (Req §9) ──────────────────────────────────────
  // Req §9: Pending=Purple, Rejected=Red, Completed=Green, RFI=Orange
  const statusColorMap = {
    pending: { color: 'Purple', hex: '#7c3aed' },
    rejected: { color: 'Red', hex: '#dc2626' },
    completed: { color: 'Green', hex: '#16a34a' },
    rfi: { color: 'Orange', hex: '#ea580c' },
    unpaid: { color: 'Gray', hex: '#6b7280' },
    partially_paid: { color: 'Yellow', hex: '#ca8a04' },
  };
  const s6 = [
    ...EXPECTED_STATUSES.map(s => ({
      name: `Status "${s}" — at least 1 invoice (${statusColorMap[s]?.color || ''})`,
      passed: (byStatus[s]?.length || 0) > 0,
      detail: `Color: ${statusColorMap[s]?.color}\nCount: ${byStatus[s]?.length || 0}\n${byStatus[s]?.map(i => `  • ${i.invoice_number} – ${i.supplier_name}`).join('\n') || '  (none)'}`,
    })),
    {
      name: 'Status badges are color-coded per §9 spec',
      info: true,
      passed: true,
      detail: 'InvoiceStatusBadge.jsx maps:\n  • pending → purple-100/purple-700\n  • rejected → red-100/red-700\n  • completed → green-100/green-700\n  • rfi → orange-100/orange-700\n  • partially_paid → yellow-100/yellow-700\n  • unpaid → slate-100/slate-700',
    },
    {
      name: 'Clicking status badge opens StatusDrillDown modal',
      info: true,
      passed: true,
      detail: 'InvoiceTable passes onViewStatus callback to each row\'s status badge button.\nStatusDrillDown opens as an overlay modal with status-specific content.',
    },
  ];

  // ── SECTION 7: Status Drill-Down (Req §10) ───────────────────────────────────
  const s7 = [
    {
      name: 'RFI invoices have rfi_items array with at least 1 item',
      passed: rfiInvoices.length > 0 && rfiInvoices.every(i => Array.isArray(i.rfi_items) && i.rfi_items.length > 0),
      detail: rfiInvoices.map(i => `  • ${i.invoice_number}: [${i.rfi_items?.map(r => r.item).join(', ')}]`).join('\n') || 'No RFI invoices',
    },
    {
      name: 'RFI drill-down shows: invoice#, supplier, due_date, missing items (§10)',
      info: true,
      passed: true,
      detail: 'StatusDrillDown.jsx renderRfiContent() shows a table with:\n  • Invoice #, Supplier, Due Date, Missing Items\nAlertCircle icon per RFI item',
    },
    {
      name: 'Completed invoices have completed_at timestamp',
      passed: completedInvoices.length > 0 && completedInvoices.every(i => !!i.completed_at),
      detail: completedInvoices.map(i => `  • ${i.invoice_number}: ${i.completed_at}`).join('\n') || 'No completed invoices',
    },
    {
      name: 'Completed invoices have processing_time (§10: "between 5 min to 5 hours")',
      passed: completedInvoices.length > 0 && completedInvoices.every(i => !!i.processing_time),
      detail: completedInvoices.map(i => `  • ${i.invoice_number}: ${i.processing_time}`).join('\n') || 'No completed invoices',
    },
    {
      name: 'Completed invoices have transaction_cost (§10: "cost per transaction")',
      passed: completedInvoices.length > 0 && completedInvoices.every(i => (i.transaction_cost || 0) > 0),
      detail: completedInvoices.map(i => `  • ${i.invoice_number}: $${i.transaction_cost}`).join('\n') || 'No completed invoices',
    },
    {
      name: 'Completed drill-down shows: time of completion, payment details, processing time, cost',
      info: true,
      passed: true,
      detail: 'StatusDrillDown.jsx renderCompletedContent() shows:\n  • Completed At\n  • Processing Time\n  • Amount Paid\n  • Transaction Cost',
    },
    {
      name: 'Pending drill-down shows payment info + submitted_at + FX rate',
      info: true,
      passed: true,
      detail: 'StatusDrillDown.jsx renderPendingContent() shows:\n  • Payment Amount, Submitted At, Est. Processing, Transaction Cost, FX Rate',
    },
    {
      name: 'Rejected drill-down shows rejection message + invoice info',
      info: true,
      passed: true,
      detail: 'StatusDrillDown.jsx renderRejectedContent() shows red alert + invoice amount + due date',
    },
  ];

  // ── SECTION 8: Batch Summary Report (Req §11) ─────────────────────────────────
  const processedAll = [...completedInvoices, ...pendingInvoices, ...rfiInvoices, ...rejectedInvoices, ...partialInvoices];
  const s8 = [
    {
      name: 'CompletionStep batch summary table has: Invoice#, Supplier, Due Date, Amount Paid, Processing Time, Cost, Status',
      info: true,
      passed: true,
      detail: 'CompletionStep.jsx renders a full table with all 7 required columns.\nProcessing time: 30min (ILS) / 2-4h (cross-border)\nCost: $5 (ILS) / $15 (cross-border)',
    },
    {
      name: 'Processed invoices have transaction_cost saved (§11)',
      passed: processedAll.filter(i => i.status !== 'rfi').every(i => (i.transaction_cost || 0) > 0),
      detail: processedAll.filter(i => i.status !== 'rfi')
        .map(i => `  • ${i.invoice_number} [${i.status}]: cost=$${i.transaction_cost}`).join('\n') || 'No processed invoices',
    },
    {
      name: 'Processed invoices have processing_time saved (§11)',
      passed: processedAll.filter(i => i.status !== 'rfi').every(i => !!i.processing_time),
      detail: processedAll.filter(i => i.status !== 'rfi')
        .map(i => `  • ${i.invoice_number}: processing_time="${i.processing_time}"`).join('\n') || 'No processed invoices',
    },
    {
      name: 'All payment statuses visible in final ISV view (§12)',
      info: true,
      passed: true,
      detail: 'Dashboard InvoiceTable shows all statuses with colored badges:\n  • Completed (green)\n  • Pending (purple)\n  • Rejected (red)\n  • RFI (orange)\n  • Partially Paid (yellow)\n  • Unpaid (gray)',
    },
    {
      name: '§12 "Back to ISV" — Dashboard shows ALL invoices after payment (full visibility)',
      passed: invoices.length > 0,
      detail: `Total invoices in system: ${invoices.length}\nStatus breakdown:\n${EXPECTED_STATUSES.map(s => `  • ${s}: ${byStatus[s]?.length || 0}`).join('\n')}`,
    },
  ];

  // ── SECTION 9: Partial Payment (Req §12) ─────────────────────────────────────
  const s9 = [
    {
      name: 'partially_paid invoices exist',
      passed: partialInvoices.length > 0,
      detail: partialInvoices.map(i => `  • ${i.invoice_number}: paid=${i.payment_amount} / total=${i.amount}`).join('\n') || 'None',
    },
    {
      name: 'payment_amount < amount for all partially_paid invoices',
      passed: partialInvoices.length > 0 && partialInvoices.every(i => i.payment_amount > 0 && i.payment_amount < i.amount),
      detail: partialInvoices.map(i => {
        const ok = i.payment_amount > 0 && i.payment_amount < i.amount;
        return `  ${ok ? '✓' : '✗'} ${i.invoice_number}: ${i.payment_amount} < ${i.amount}`;
      }).join('\n') || 'None',
    },
    {
      name: 'Partially paid drill-down shows remaining balance',
      info: true,
      passed: true,
      detail: 'StatusDrillDown.jsx renderPartiallyPaidContent() shows:\n  • Total Invoice\n  • Amount Paid\n  • Remaining Balance (amount - payment_amount)\n  • Paid At timestamp',
    },
  ];

  // ── SECTION 10: UI/UX Copy & Flow Checks (Req §2, §3, §5) ────────────────────
  const s10 = [
    {
      name: '§2 Banner text: "Did you know that you can now make cross-border payments..."',
      info: true,
      passed: true,
      detail: 'ActivationBanner.jsx renders:\n"Did you know that you can now make cross-border payments directly from your Accounts Payable module?"\nWith "Join now" CTA button.',
    },
    {
      name: '§3 Onboarding page message: "Open your cross-border account now..."',
      info: true,
      passed: true,
      detail: 'BankOnboarding.jsx renders:\n"Open your cross-border account now and start sending money Cross Border – faster, at lower cost, and directly from your Accounts Payable module."\nCTA: "Open my account"',
    },
    {
      name: '§3 Partner bank branding: Altshuler Shaham logo shown',
      info: true,
      passed: true,
      detail: 'BankOnboarding.jsx shows Altshuler Shaham logo in the header with "Partner Bank" label.',
    },
    {
      name: '§3 Onboarding form fields: Company Name, Registration Number, Country, Contact Name, Email, Phone',
      info: true,
      passed: true,
      detail: 'BankOnboarding.jsx form contains all 6 required fields.',
    },
    {
      name: '§3 Processing animation is "fast-paced and friction-light"',
      info: true,
      passed: true,
      detail: 'BankOnboarding.jsx uses animated Progress bar with random increments (5-20% per 400ms).\nCompletes in ~3-5 seconds, then shows "Your account is open!"',
    },
    {
      name: '§4 Success screen: "Your account is open!" message',
      info: true,
      passed: true,
      detail: 'BankOnboarding.jsx "activated" step shows:\n  • "Your account is open!" heading\n  • Balance cards: ₪330,000 / $150,000 / €75,000\n  • "Start making payments" CTA',
    },
    {
      name: '§5 Pay now buttons turn GREEN after activation (not disabled)',
      info: true,
      passed: true,
      detail: 'Dashboard.jsx: isKybVerified controls button state.\nWhen active: bg-accent (green) class applied.\nWhen inactive: bg-muted (grayed out) class applied.',
    },
    {
      name: '§5 Non-ILS rows highlighted with ring-accent border when KYB active',
      info: true,
      passed: true,
      detail: 'InvoiceTable.jsx applies: ring-1 ring-inset ring-accent/20\nCondition: isKybVerified && isCrossBorder && isPayable',
    },
    {
      name: '§6 "Proceed to payment" saves beneficiary data for future payments',
      info: true,
      passed: true,
      detail: 'Dashboard.jsx handlePaymentComplete() calls Invoice.update() with:\n  • beneficiary_account\n  • beneficiary_address\n  • payment_currency\n  • payment_amount\n  • fx_rate\nData is persisted to the ISV database.',
    },
    {
      name: '§6 IBAN / Account / Address validation badges shown in blue (Mastercard API)',
      info: true,
      passed: true,
      detail: 'InvoiceReviewStep.jsx shows blue "Validated via MC API" badge with Shield icon when:\n  • iban_validated = true\n  • account_validated = true\n  • address_validated = true',
    },
    {
      name: '§6 Missing fields highlighted in orange',
      info: true,
      passed: true,
      detail: 'InvoiceReviewStep.jsx applies:\n  • border-orange-300 bg-orange-50/50 on empty IBAN/address inputs\n  • AlertTriangle icon + "Required field" text below empty fields',
    },
  ];

  const allSections = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];
  const allTests = allSections.flat();
  const testable = allTests.filter(t => !t.info);
  const passedCount = testable.filter(t => t.passed).length;
  const failedCount = testable.filter(t => !t.passed && !t.warn).length;
  const pct = Math.round((passedCount / testable.length) * 100);

  const sectionDefs = [
    { title: '§1-4 Onboarding & Activation', req: 'Banner, Join Now, Account Opening, Balance Display', tests: s1 },
    { title: '§1, §5 Invoice Table & Buttons', req: 'Pay Now buttons, cross-border highlighting, currency coverage', tests: s2 },
    { title: '§6 Invoice Review (iFrame/Bot)', req: 'Supplier, Currency, Amount, IBAN, Address, FX, File attachment', tests: s3 },
    { title: '§7 Batch Overview', req: 'Invoice#, Supplier, Due Date, Invoice Amt, Payment Amt, FX Rate, Total, Actions', tests: s4 },
    { title: '§8 Funding / Balance Check', req: 'Sufficient/Gap detection, EUR 15k gap scenario, RTP/MASAV/A2A', tests: s5 },
    { title: '§9 Status Tracking & Colors', req: 'All 6 statuses with correct colors per spec', tests: s6 },
    { title: '§10 Status Drill-Down', req: 'RFI missing items, Completed time+cost, Pending details', tests: s7 },
    { title: '§11-12 Batch Summary & End State', req: 'Report with processing time + cost, all statuses visible', tests: s8 },
    { title: '§12 Partial Payment', req: 'partially_paid status, remaining balance shown', tests: s9 },
    { title: '§2-3-5-6 UI/UX Copy & Flow', req: 'Banner text, onboarding copy, validation badges, button states', tests: s10 },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Flow Test Suite</h1>
          <p className="text-sm text-muted-foreground mt-1">End-to-end validation against XBS demo requirements</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Re-run
        </Button>
      </div>

      {/* Summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Overall Result</p>
          <Badge className={pct === 100 ? 'bg-green-100 text-green-700' : pct >= 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
            {passedCount}/{testable.length} passed ({pct}%)
          </Badge>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{passedCount}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{allTests.filter(t => t.info).length}</p>
            <p className="text-xs text-muted-foreground">Info Checks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted-foreground">{invoices.length}</p>
            <p className="text-xs text-muted-foreground">Invoices</p>
          </div>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Data test passed</div>
        <div className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-600" /> Data test failed</div>
        <div className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-yellow-600" /> Warning</div>
        <div className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-blue-600" /> UI implementation note</div>
      </div>

      {sectionDefs.map((sec, si) => {
        const testable = sec.tests.filter(t => !t.info);
        const passed = testable.filter(t => t.passed).length;
        return (
          <Section key={si} title={sec.title} req={sec.req} passed={passed} total={testable.length}>
            {sec.tests.map((t, i) => <TestResult key={i} {...t} />)}
          </Section>
        );
      })}
    </div>
  );
}