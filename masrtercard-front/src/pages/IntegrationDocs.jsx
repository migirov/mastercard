import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Code2, Layers, ChevronRight, CheckCircle2, Copy, Check,
  Globe, CreditCard, MessageSquare, Bell, ArrowRight, Terminal,
  FileText, Shield, Database, Webhook, BookOpen, ExternalLink
} from 'lucide-react';

// ─── tiny helpers ───────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, language = 'json' }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 mt-3">
      <div className="bg-slate-800 flex items-center justify-between px-4 py-2">
        <span className="text-[11px] text-white/40 font-mono uppercase tracking-wider">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="bg-slate-900 p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, color = 'text-blue-400' }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Step({ number, title, description, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
          {number}
        </div>
        <div className="w-px flex-1 bg-white/10 mt-2" />
      </div>
      <div className="pb-8 flex-1">
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-white/50 mb-3">{description}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────
const INVOICE_SCHEMA = `{
  "invoice_number": "INV-2026-0042",       // string, required
  "supplier_name":  "Acme Supplies Ltd.",  // string, required
  "currency":       "USD",                 // "ILS" | "USD" | "EUR", required
  "amount":         12500.00,              // number, required
  "due_date":       "2026-06-15",          // ISO 8601 date, required
  "beneficiary_account": "IL620108000000099999999", // IBAN or local acct
  "beneficiary_address": "123 Main St, Tel Aviv",
  "file_url":       "https://your-erp.com/docs/INV-2026-0042.pdf"
}`;

const WEBHOOK_PAYLOAD = `// XBS sends this to your ERP when payment status changes
{
  "event":          "payment.status_changed",
  "invoice_number": "INV-2026-0042",
  "status":         "completed",  // pending | processing | completed | rejected | rfi
  "payment_amount": 12500.00,
  "payment_currency": "USD",
  "fx_rate":        3.618,
  "completed_at":   "2026-05-07T14:23:00Z",
  "transaction_cost": 15.00
}`;

const BANNER_SNIPPET = `<!-- Add inside your AP module header -->
<xbs-activation-banner
  partner-id="YOUR_PARTNER_ID"
  company-id="{{ current_company.id }}"
  on-activate="handleXBSActivation"
/>

<!-- React / Angular / Vue equivalent -->
import { XBSActivationBanner } from '@xbs/erp-sdk';

<XBSActivationBanner
  partnerId="YOUR_PARTNER_ID"
  companyId={company.id}
  onActivate={(token) => saveXBSToken(token)}
/>`;

const BUTTON_SNIPPET = `<!-- Pay Now button — place next to each invoice row -->
<xbs-pay-button
  invoice-id="{{ invoice.id }}"
  invoice-data="{{ invoice | xbs_format }}"
  partner-id="YOUR_PARTNER_ID"
  on-complete="onPaymentComplete"
/>

// Or invoke programmatically
import { XBSPaymentSDK } from '@xbs/erp-sdk';

const sdk = new XBSPaymentSDK({ partnerId: 'YOUR_PARTNER_ID' });
sdk.openPaymentFlow({
  invoices: selectedInvoices.map(inv => ({
    invoice_number: inv.number,
    supplier_name:  inv.vendor,
    currency:       inv.currency,
    amount:         inv.balance_due,
    due_date:       inv.due_date,
    beneficiary_account: inv.iban,
    beneficiary_address: inv.vendor_address,
  }))
});`;

const BOT_SNIPPET = `<!-- Floating XBS Bot — add once to your AP page layout -->
<xbs-chatbot
  partner-id="YOUR_PARTNER_ID"
  company-id="{{ current_company.id }}"
  theme="auto"          <!-- auto | light | dark -->
  position="bottom-right"
/>

// The bot auto-detects the user's account status.
// No additional configuration needed after the banner activation.`;

const PLATFORMS = [
  { name: 'Salesforce', logo: '🔵', color: 'from-blue-600 to-blue-700', tag: 'Lightning Web Component' },
  { name: 'Priority ERP', logo: '🟠', color: 'from-orange-500 to-orange-600', tag: 'Web SDK + REST' },
  { name: 'SAP S/4HANA', logo: '🔷', color: 'from-sky-600 to-sky-700', tag: 'SAPUI5 / Fiori' },
  { name: 'NetSuite', logo: '🟣', color: 'from-purple-600 to-purple-700', tag: 'SuiteScript 2.x' },
  { name: 'Microsoft D365', logo: '🟦', color: 'from-indigo-600 to-indigo-700', tag: 'PCF Control' },
  { name: 'Oracle ERP', logo: '🔴', color: 'from-red-600 to-red-700', tag: 'ADF / JET Component' },
];

const REQUIREMENTS = [
  { icon: CheckCircle2, text: 'Ability to embed a 3rd-party JavaScript / Web Component in the AP module UI' },
  { icon: CheckCircle2, text: 'REST API or outbound webhook endpoint to receive payment status updates' },
  { icon: CheckCircle2, text: 'Read access to invoice fields: number, vendor, amount, currency, due date, IBAN' },
  { icon: CheckCircle2, text: 'SSO / OAuth token passthrough for user identity (optional but recommended)' },
  { icon: CheckCircle2, text: 'HTTPS support for the ERP domain (for CSP / CORS allow-listing)' },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IntegrationDocs() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview',   label: 'Overview',        icon: BookOpen },
    { id: 'data',       label: 'Data Model',       icon: Database },
    { id: 'components', label: 'UI Components',    icon: Layers },
    { id: 'approvals',  label: 'Approvals',        icon: Shield },
    { id: 'webhooks',   label: 'Webhooks',         icon: Webhook },
    { id: 'platforms',  label: 'Platforms',        icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top hero */}
      <div className="border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-blue-400" />
            </div>
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs font-semibold">
              XBS Integration SDK — v1.0
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            ERP Integration Guide
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            Everything a product manager or developer needs to embed XBS cross-border payment capabilities into Salesforce, Priority, SAP, and other ERP platforms.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            {PLATFORMS.map(p => (
              <span key={p.name} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60">
                {p.logo} {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-white/10 bg-slate-900 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* What is XBS */}
            <section>
              <SectionTitle icon={Globe} title="What is XBS Embedded?" subtitle="A turnkey cross-border payment module you embed inside your ERP" color="text-blue-400" />
              <p className="text-white/60 leading-relaxed max-w-3xl">
                XBS Embedded lets any Accounts Payable module offer cross-border wire transfers — without building payment infrastructure. You add three lightweight components to your UI and connect one webhook. The rest is handled by XBS and its partner banks (Altshuler Shaham).
              </p>
            </section>

            {/* Architecture */}
            <section>
              <SectionTitle icon={Layers} title="Architecture at a Glance" color="text-violet-400" />
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Activation Banner', desc: 'Shown once to the AP user. Triggers KYB onboarding via XBS. Returns an account token stored against the ERP company record.', icon: Bell, color: 'text-yellow-400', bg: 'from-yellow-500/10 to-yellow-600/5' },
                  { step: '2', title: 'Pay Now Button', desc: 'Placed next to each invoice row. Opens the XBS payment flow pre-filled with invoice data. Requires the account token from step 1.', icon: CreditCard, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-600/5' },
                  { step: '3', title: 'XBS Bot', desc: 'A floating assistant that shows payment history, FX rates, RFI alerts, and AI-powered answers. Zero configuration after activation.', icon: MessageSquare, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-600/5' },
                ].map(item => (
                  <div key={item.step} className={`p-5 rounded-2xl bg-gradient-to-br ${item.bg} border border-white/10`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-widest ${item.color}`}>Component {item.step}</span>
                    </div>
                    <h4 className="font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Prerequisites */}
            <section>
              <SectionTitle icon={Shield} title="Prerequisites" subtitle="Technical requirements before starting integration" color="text-orange-400" />
              <div className="space-y-3">
                {REQUIREMENTS.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8">
                    <r.icon className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white/70">{r.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Flow diagram */}
            <section>
              <SectionTitle icon={ArrowRight} title="End-to-End Payment Flow" color="text-emerald-400" />
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                {[
                  { label: 'AP User opens invoice list', icon: FileText },
                  { label: 'Banner triggers KYB once', icon: Bell },
                  { label: 'User selects invoices & clicks Pay Now', icon: CreditCard },
                  { label: 'XBS validates & routes payment', icon: Globe },
                  { label: 'Webhook updates ERP invoice status', icon: Webhook },
                ].map((item, i) => (
                  <React.Fragment key={i}>
                    <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-2">
                      <item.icon className="w-5 h-5 text-blue-400" />
                      <p className="text-xs text-white/60 leading-snug">{item.label}</p>
                    </div>
                    {i < 4 && <div className="flex items-center justify-center text-white/20 px-1"><ChevronRight className="w-4 h-4 rotate-90 md:rotate-0" /></div>}
                  </React.Fragment>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── DATA MODEL ────────────────────────────────────────────────────── */}
        {activeTab === 'data' && (
          <div className="space-y-10">
            <section>
              <SectionTitle icon={Database} title="Invoice Data Schema" subtitle="Fields your ERP must supply to the XBS SDK" color="text-blue-400" />
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    When the user clicks <strong className="text-white">Pay Now</strong>, your ERP must pass an invoice object matching this schema. Required fields are marked — missing values will block submission.
                  </p>
                  <div className="space-y-2">
                    {[
                      { field: 'invoice_number', type: 'string', req: true, note: 'Unique invoice ID in your system' },
                      { field: 'supplier_name',  type: 'string', req: true, note: 'Beneficiary / vendor display name' },
                      { field: 'currency',       type: 'enum',   req: true, note: '"ILS" | "USD" | "EUR"' },
                      { field: 'amount',         type: 'number', req: true, note: 'Total invoice amount' },
                      { field: 'due_date',       type: 'date',   req: true, note: 'ISO 8601 e.g. 2026-06-15' },
                      { field: 'beneficiary_account', type: 'string', req: false, note: 'IBAN or local account number' },
                      { field: 'beneficiary_address', type: 'string', req: false, note: 'Vendor street address' },
                      { field: 'file_url',       type: 'string', req: false, note: 'Public URL of the invoice PDF' },
                    ].map(row => (
                      <div key={row.field} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8 text-xs">
                        <code className="text-blue-300 font-mono w-40 shrink-0">{row.field}</code>
                        <span className="text-white/30 w-14 shrink-0">{row.type}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.req ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-white/30'}`}>
                          {row.req ? 'required' : 'optional'}
                        </span>
                        <span className="text-white/40 truncate">{row.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1 font-mono uppercase tracking-wider">Example payload</p>
                  <CodeBlock code={INVOICE_SCHEMA} language="json" />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={Webhook} title="Payment Status Enum" subtitle="All possible values for the invoice status field" color="text-violet-400" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { status: 'unpaid',        color: 'bg-slate-500/15 text-slate-400',   desc: 'Invoice not yet submitted to XBS' },
                  { status: 'pending',       color: 'bg-purple-500/15 text-purple-400', desc: 'Submitted, awaiting bank processing' },
                  { status: 'processing',    color: 'bg-blue-500/15 text-blue-400',     desc: 'In transit through payment rails' },
                  { status: 'completed',     color: 'bg-emerald-500/15 text-emerald-400', desc: 'Funds delivered to beneficiary' },
                  { status: 'rejected',      color: 'bg-red-500/15 text-red-400',       desc: 'Payment declined — see rejection reason' },
                  { status: 'rfi',           color: 'bg-orange-500/15 text-orange-400', desc: 'Request for Information — missing docs' },
                  { status: 'partially_paid',color: 'bg-amber-500/15 text-amber-400',   desc: 'Partial payment processed' },
                ].map(s => (
                  <div key={s.status} className="p-4 rounded-xl bg-white/3 border border-white/8">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.color} mb-2`}>{s.status}</span>
                    <p className="text-xs text-white/50">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── APPROVALS ─────────────────────────────────────────────────────── */}
        {activeTab === 'approvals' && (
          <div className="space-y-12">
            <section>
              <SectionTitle icon={Shield} title="Payment Approval Workflow" subtitle="Multi-user approval process for batch cross-border payments" color="text-blue-400" />
              <p className="text-white/60 text-sm leading-relaxed max-w-3xl mb-6">
                The XBS Approvals module enables organizations to enforce approval workflows for payment batches before execution. An employee submits invoices for approval, and a manager reviews, approves, or rejects with detailed comments. Once approved, payments are immediately scheduled for processing.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Workflow stages</p>
                  {[
                    { stage: 'Submission', desc: 'Employee selects invoices and submits batch for approval with optional notes', color: 'text-blue-400' },
                    { stage: 'Review', desc: 'Approver sees pending batches, invoice details, and FX calculations', color: 'text-yellow-400' },
                    { stage: 'Approval', desc: 'Manager approves batch or rejects with specific reason', color: 'text-emerald-400' },
                    { stage: 'Execution', desc: 'Approved batches are queued and processed per schedule', color: 'text-purple-400' },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/3 border border-white/8">
                      <p className={`text-sm font-semibold ${item.color} mb-1`}>{item.stage}</p>
                      <p className="text-xs text-white/50">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Key features</p>
                  {[
                    'Batch submissions with multiple invoices (up to 100 per batch)',
                    'Real-time FX rate quotes locked for 15 minutes from submission',
                    'Individual invoice document viewer within approval interface',
                    'Rejection with mandatory detailed reason / comments',
                    'Audit trail: all approvals, rejections, and state changes logged',
                    'Email notifications to approvers (pending, approved, rejected states)',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/8 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-white/60">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={Database} title="Approval Data Schema" subtitle="PaymentApproval entity structure" color="text-violet-400" />
              <CodeBlock code={`{
  "id": "appr-2026-0001",
  "requester_id": "user-123",
  "requester_name": "David Cohen",
  "approver_id": "user-456",
  "approver_name": "Sarah Levy",
  "invoice_ids": ["INV-001", "INV-002"],
  "entity_name": "Invoice",
  "total_amount_usd": 18500,
  "status": "pending",  // pending | approved | rejected
  "notes_to_approver": "Urgent supplier payments — please review",
  "rejection_note": null,  // filled only if rejected
  "invoice_details": [
    {
      "invoice_number": "INV-001",
      "supplier_name": "Global Tech",
      "amount": 12000,
      "currency": "USD",
      "payment_amount": 12000,
      "payment_currency": "USD",
      "fx_rate": 1
    }
  ],
  "fx_quote_data": [
    {
      "invoice_id": "INV-001",
      "payment_currency": "USD",
      "fx_rate": 1,
      "payment_amount": 12000
    }
  ],
  "created_date": "2026-05-12T10:00:00Z",
  "created_by": "david@company.com",
  "updated_date": "2026-05-12T12:30:00Z"
}`} language="json" />
            </section>

            <section>
              <SectionTitle icon={Layers} title="Approval UI Component" subtitle="ApprovalNotificationBanner for dashboard integration" color="text-emerald-400" />
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    A banner component displays pending payment approvals prominently on the main dashboard. Approvers see at-a-glance status badges, countdown timers (FX quote validity), and inline actions to approve or reject.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Approval Card Features</p>
                    {[
                      { feature: 'Countdown Timer', desc: 'Shows FX quote expiry (15 min from submission)' },
                      { feature: 'Expandable Details', desc: 'Toggle to see invoices, beneficiary info, and FX details' },
                      { feature: 'Document Viewer', desc: 'Eye icon to view attached invoice PDF/image' },
                      { feature: 'Approval Actions', desc: 'Approve with 1 click or Reject with mandatory reason' },
                      { feature: 'Rejection History', desc: 'Show previous rejection notes if resubmitted' },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/8 text-xs">
                        <code className="text-emerald-300 font-mono">{item.feature}</code>
                        <p className="text-white/40 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1 font-mono uppercase tracking-wider">Component props</p>
                  <CodeBlock code={`<ApprovalNotificationBanner />

// Auto-fetches pending approvals from PaymentApproval entity
// Displays only to authenticated users with approver role
// Shows countdown timers for FX quote validity
// Integrates InvoiceDocViewer for document preview
// Mutations handle approve/reject + invoice status updates

// Usage
import ApprovalNotificationBanner from '@/components/notifications/ApprovalNotificationBanner';

<ApprovalNotificationBanner />`} language="jsx" />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={Terminal} title="Submission Flow — Backend Integration" subtitle="How to submit a payment batch for approval" color="text-blue-400" />
              <CodeBlock language="javascript" code={`// 1. Employee selects invoices and submits
const selectedInvoices = [{ id: 'INV-001', amount: 12000, currency: 'USD' }];

// 2. Frontend calls backend function to create PaymentApproval
const result = await api.functions.invoke('submitPaymentForApproval', {
  invoice_ids: selectedInvoices.map(inv => inv.id),
  entity_name: 'Invoice',
  approver_id: 'user-456',  // manager ID from org hierarchy
  notes_to_approver: 'Urgent supplier payment'
});
// Returns: { approval_id, status: 'pending', fx_quotes: [...] }

// 3. Approval system sends email notification to approver
// Approver sees banner on dashboard with countdown timer

// 4. Approver action triggers status update
await api.entities.PaymentApproval.update(approval_id, {
  status: 'approved'
});

// 5. Webhook notifies backend — invoices auto-marked 'pending' for payment
// Approval state persists for audit`} />
            </section>
          </div>
        )}

        {/* ── UI COMPONENTS ────────────────────────────────────────────────── */}
        {activeTab === 'components' && (
          <div className="space-y-12">
            {/* Banner */}
            <section>
              <SectionTitle icon={Bell} title="1 — Activation Banner" subtitle="Show once per company when cross-border payments are not yet activated" color="text-yellow-400" />
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    The banner is a <strong className="text-white">full-screen modal</strong> that appears the first time an AP user opens the invoice list. It walks the user through KYB verification and account activation. Once activated, it never shows again for that company.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Trigger conditions</p>
                    {['Company has not yet completed XBS KYB', 'User has AP manager role or above', 'Triggered on first page load of the invoice list'].map((t,i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {t}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Callback events</p>
                    {[
                      { event: 'onActivate(token)', desc: 'Save the returned XBS account token to your company record' },
                      { event: 'onDismiss()',       desc: 'User closed — re-show after 7 days' },
                    ].map((e,i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/8 text-xs">
                        <code className="text-yellow-300 font-mono">{e.event}</code>
                        <p className="text-white/40 mt-1">{e.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {/* Visual mockup */}
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xs font-bold text-slate-800">AS</div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Powered by</p>
                            <p className="text-sm font-bold text-white">Altshuler Shaham</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-full px-2 py-1 font-semibold">✦ New Feature</span>
                      </div>
                      <p className="text-white font-bold text-base mb-2">Make cross-border payments directly from your AP module</p>
                      <p className="text-white/40 text-xs mb-4">Send money internationally — faster, at lower cost.</p>
                      <div className="bg-blue-600 rounded-lg px-4 py-2 text-white text-xs font-semibold text-center">Join now →</div>
                    </div>
                  </div>
                  <CodeBlock code={BANNER_SNIPPET} language="html / jsx" />
                </div>
              </div>
            </section>

            {/* Pay Now */}
            <section>
              <SectionTitle icon={CreditCard} title="2 — Pay Now Button" subtitle="Inline button in each invoice row that opens the XBS payment flow" color="text-emerald-400" />
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    The button renders as part of your invoice table's action column. It is <strong className="text-white">disabled</strong> until the company's XBS account is active. On click, it opens a side panel pre-filled with the invoice data — no manual entry required.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Required props</p>
                    {[
                      { prop: 'invoices[]',  desc: 'Array of invoice objects (see Data Model)' },
                      { prop: 'partnerId',   desc: 'Your XBS partner identifier' },
                      { prop: 'companyId',   desc: 'ERP company/tenant identifier' },
                      { prop: 'onComplete',  desc: 'Callback when payment is submitted' },
                    ].map((p,i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/8 text-xs flex gap-3">
                        <code className="text-emerald-300 font-mono w-28 shrink-0">{p.prop}</code>
                        <span className="text-white/40">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {/* Visual mockup */}
                  <div className="rounded-2xl overflow-hidden border border-white/10">
                    <div className="bg-slate-800 p-1">
                      <table className="w-full text-xs">
                        <thead><tr className="text-white/30 border-b border-white/10">
                          <th className="text-left p-2 font-normal">Invoice #</th>
                          <th className="text-left p-2 font-normal">Supplier</th>
                          <th className="text-right p-2 font-normal">Amount</th>
                          <th className="text-right p-2 font-normal">Action</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { num: 'INV-001', sup: 'Acme Ltd', amt: '$12,500', payable: true },
                            { num: 'INV-002', sup: 'Global Co', amt: '€4,200', payable: true },
                            { num: 'INV-003', sup: 'Local Srv', amt: '₪8,000', payable: false },
                          ].map(row => (
                            <tr key={row.num} className="border-b border-white/5 text-white/60">
                              <td className="p-2">{row.num}</td>
                              <td className="p-2">{row.sup}</td>
                              <td className="p-2 text-right font-semibold text-white">{row.amt}</td>
                              <td className="p-2 text-right">
                                {row.payable
                                  ? <span className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold">Pay now</span>
                                  : <span className="px-2 py-1 rounded bg-white/5 text-white/30">Details</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <CodeBlock code={BUTTON_SNIPPET} language="html / jsx" />
                </div>
              </div>
            </section>

            {/* Bot */}
            <section>
              <SectionTitle icon={MessageSquare} title="3 — XBS Bot" subtitle="Floating assistant for payment status, FX rates, and AI Q&A" color="text-blue-400" />
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    A single script tag adds a floating button to your AP module. The bot provides real-time payment tracking, FX rate lookup, RFI alerts, and an AI chat trained on your payment history and documentation.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Tabs inside the bot</p>
                    {[
                      { icon: CreditCard,    label: 'Payments',     desc: 'Live invoice & balance status' },
                      { icon: FileText,      label: 'Reports',      desc: 'Processed invoices & costs' },
                      { icon: MessageSquare, label: 'AI Chat',      desc: 'Natural language payment queries' },
                      { icon: BookOpen,      label: 'Knowledge Base', desc: 'Integration & compliance docs' },
                    ].map((t,i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8 text-xs">
                        <t.icon className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <span className="text-white font-medium">{t.label}</span>
                          <span className="text-white/40 ml-2">{t.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {/* Visual mockup */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 h-48 flex items-end justify-end p-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-80" />
                    <div className="relative z-10 text-right">
                      <div className="mb-2 bg-slate-800 rounded-xl p-3 text-xs text-white/60 border border-white/10 max-w-[180px] text-left ml-auto">
                        <p className="font-semibold text-white text-[11px] mb-1">XBS Assistant</p>
                        Invoice INV-001 is <span className="text-emerald-400">completed</span>. Funds arrived May 6.
                      </div>
                      <div className="w-14 h-14 rounded-full bg-blue-600 flex flex-col items-center justify-center shadow-xl ml-auto">
                        <span className="font-black text-sm leading-none">XBS</span>
                        <span className="text-[8px] text-blue-200">chat</span>
                      </div>
                    </div>
                  </div>
                  <CodeBlock code={BOT_SNIPPET} language="html / jsx" />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── WEBHOOKS ──────────────────────────────────────────────────────── */}
        {activeTab === 'webhooks' && (
          <div className="space-y-10">
            <section>
              <SectionTitle icon={Webhook} title="Status Webhook" subtitle="XBS calls your ERP endpoint whenever a payment status changes" color="text-violet-400" />
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-white/60 text-sm leading-relaxed">
                    Register a webhook URL in the XBS partner dashboard. XBS will POST a JSON payload to that URL for every status change. Your ERP must respond with <code className="text-white bg-white/10 px-1 rounded">HTTP 200</code> within 10 seconds.
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: 1, title: 'Register endpoint', desc: 'Add your HTTPS URL in the XBS partner dashboard under Settings → Webhooks' },
                      { step: 2, title: 'Verify signature',  desc: 'Each request includes an X-XBS-Signature header. Validate it using your webhook secret.' },
                      { step: 3, title: 'Update invoice',    desc: 'Find the invoice by invoice_number and update its status field in your ERP database.' },
                      { step: 4, title: 'Return 200',        desc: 'Respond promptly. XBS retries up to 5 times with exponential backoff on failure.' },
                    ].map(s => (
                      <div key={s.step} className="flex gap-3 p-4 rounded-xl bg-white/3 border border-white/8">
                        <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">{s.step}</div>
                        <div>
                          <p className="text-sm font-semibold text-white">{s.title}</p>
                          <p className="text-xs text-white/50 mt-0.5">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-3">Webhook payload example</p>
                  <CodeBlock code={WEBHOOK_PAYLOAD} language="json" />
                  <div className="mt-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-orange-400 font-semibold mb-1">⚠ Idempotency</p>
                    <p className="text-xs text-white/50">The same event may be delivered more than once. Use <code className="text-orange-300">invoice_number</code> as the idempotency key — skip the update if the status is already equal or more advanced.</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle icon={Terminal} title="Signature Verification" subtitle="Validate every incoming webhook to prevent spoofing" color="text-blue-400" />
              <CodeBlock language="javascript" code={`// Node.js / Express example
const crypto = require('crypto');

app.post('/xbs-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig       = req.headers['x-xbs-signature'];
  const secret    = process.env.XBS_WEBHOOK_SECRET;
  const expected  = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (sig !== \`sha256=\${expected}\`) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  // update your ERP invoice status here ...
  res.sendStatus(200);
});`} />
            </section>
          </div>
        )}

        {/* ── PLATFORMS ─────────────────────────────────────────────────────── */}
        {activeTab === 'platforms' && (
          <div className="space-y-10">
            <section>
              <SectionTitle icon={Globe} title="Platform-Specific Notes" subtitle="Key integration points for each supported ERP / CRM platform" color="text-blue-400" />
              <div className="grid md:grid-cols-2 gap-5">
                {[
                  {
                    name: 'Salesforce',
                    logo: '🔵',
                    tag: 'Lightning Web Component',
                    steps: [
                      'Create an LWC wrapper component in your Salesforce org',
                      'Use @salesforce/apex to call a custom Apex class that reads invoice__c records',
                      'Embed <xbs-activation-banner> inside the AP Lightning page via Dynamic Forms',
                      'Add <xbs-pay-button> as an action column in the invoice list view',
                      'Register a Platform Event or REST callout for the webhook receiver',
                    ],
                  },
                  {
                    name: 'Priority ERP',
                    logo: '🟠',
                    tag: 'Web SDK + REST Hooks',
                    steps: [
                      'Use Priority\'s Web SDK to inject a custom HTML panel into the ACCPAYINVOICES form',
                      'Read invoice data via the Priority OData REST API (/ACCPAYINVOICES)',
                      'Register a Priority Trigger (TRIGGERP) to fire on status field update',
                      'Use BPM procedures to call the XBS webhook receiver URL on status change',
                      'Store the XBS account token in a custom COMPANY extended field',
                    ],
                  },
                  {
                    name: 'SAP S/4HANA',
                    logo: '🔷',
                    tag: 'SAPUI5 / Fiori Extension',
                    steps: [
                      'Extend the Manage Supplier Invoices (F0859) Fiori app with a UI5 fragment',
                      'Consume the XBS SDK via an npm dependency in your Fiori extension project',
                      'Read invoice data using the SAP S/4 Accounts Payable OData v4 service',
                      'Use BTP Integration Suite to route XBS webhooks into SAP workflows',
                      'Store XBS account token in a custom Business Partner attribute',
                    ],
                  },
                  {
                    name: 'NetSuite',
                    logo: '🟣',
                    tag: 'SuiteScript 2.x',
                    steps: [
                      'Create a SuiteScript 2.x ClientScript deployed on the Vendor Bill record type',
                      'Add a custom HTML field (inline HTML type) to the Vendor Bill form for the XBS button',
                      'Use SuiteScript N/https module to POST invoice data to the XBS SDK init endpoint',
                      'Create a RESTlet that acts as the webhook receiver and updates Vendor Bill status',
                      'Store XBS token in a custom Subsidiary record field',
                    ],
                  },
                  {
                    name: 'Microsoft D365 F&O',
                    logo: '🟦',
                    tag: 'Power Component Framework',
                    steps: [
                      'Build a PCF (Power Component Framework) control wrapping the XBS SDK',
                      'Deploy the PCF control to the Vendor Invoice journal form',
                      'Use D365 Data Entities (VendInvoiceInfoTable) to read invoice data',
                      'Configure a Logic App or Azure Function as the webhook receiver',
                      'Store XBS account token in a custom Legal Entity field',
                    ],
                  },
                  {
                    name: 'Oracle ERP Cloud',
                    logo: '🔴',
                    tag: 'ADF / Oracle JET Component',
                    steps: [
                      'Create an Oracle JET composite component embedding the XBS SDK',
                      'Deploy via Oracle\'s Application Composer or Page Composer',
                      'Read invoice data via Oracle Financials Cloud REST APIs (payablesInvoices)',
                      'Configure an Integration Cloud (OIC) flow as the webhook receiver',
                      'Use Business Events to trigger status updates back into Oracle Payables',
                    ],
                  },
                ].map(p => (
                  <div key={p.name} className="p-5 rounded-2xl bg-white/3 border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{p.logo}</span>
                      <div>
                        <h4 className="font-bold text-white">{p.name}</h4>
                        <span className="text-[11px] text-white/40">{p.tag}</span>
                      </div>
                    </div>
                    <ol className="space-y-2">
                      {p.steps.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs text-white/60">
                          <span className="text-white/25 shrink-0">{i + 1}.</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle icon={FileText} title="Checklist for Product Managers" subtitle="Use this list to validate integration readiness with your dev team" color="text-emerald-400" />
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  'UI framework supports embedding 3rd-party Web Components or React components',
                  'Invoice list page can be customized with new action buttons',
                  'ERP can store an arbitrary account token per company/tenant',
                  'A full-screen modal overlay can be triggered from the AP module',
                  'ERP exposes an HTTPS endpoint for receiving inbound webhooks',
                  'Developer can map internal invoice fields to the XBS schema (5 required fields)',
                  'SSO/SAML or OAuth identity can optionally be passed to the XBS SDK',
                  'Environments for dev, staging, and prod can each have separate XBS partner credentials',
                  'Change control process allows deploying new UI components within a sprint',
                  'Legal / compliance reviewed the XBS data processing agreement',
                ].map((item, i) => (
                  <label key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8 cursor-pointer hover:bg-white/5 transition-colors">
                    <input type="checkbox" className="mt-0.5 accent-emerald-500 w-4 h-4 shrink-0" />
                    <span className="text-sm text-white/60">{item}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">XBS Embedded SDK — Integration Documentation v1.0 · Confidential</p>
          <div className="flex items-center gap-4">
            <a href="#" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Full API Reference
            </a>
            <a href="#" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Postman Collection
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}