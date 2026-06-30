/**
 * Demo seed data, keyed by entity type. Inserted on boot (idempotently — only
 * when the entity type is empty) by `SeedService`, so the frontend is populated
 * out of the box. Plausible fixtures for the "Fintory Demo Ltd" company; not real data.
 *
 * Each value is the document stored in `records.data` for that entity type — id and
 * timestamps are managed by the store and must NOT appear here.
 */

export const SEED_DATA: Record<string, Record<string, unknown>[]> = {
  CompanyProfile: [
    {
      company_name: 'Fintory Demo Ltd',
      kyb_verified: true,
      account_active: true,
      balance_ils: 250000,
      balance_usd: 80000,
      balance_eur: 60000,
      onboarding_step: 'activated',
    },
  ],

  Invoice: [
    {
      invoice_number: 'INV-1001',
      supplier_name: 'Nordwind Components GmbH',
      currency: 'EUR',
      amount: 12450.0,
      due_date: '2026-07-15',
      beneficiary_account: 'DE89370400440532013000',
      beneficiary_address: 'Hafenstrasse 12, 20359 Hamburg, Germany',
      status: 'unpaid',
    },
    {
      invoice_number: 'INV-1002',
      supplier_name: 'Brightline Logistics LLC',
      currency: 'USD',
      amount: 8200.5,
      due_date: '2026-07-09',
      beneficiary_account: 'US64SVBKUS6S3300958879',
      beneficiary_address: '500 Market St, San Francisco, CA 94105, USA',
      status: 'processing',
    },
    {
      invoice_number: 'INV-1003',
      supplier_name: 'Galil Software Ltd',
      currency: 'ILS',
      amount: 31000.0,
      due_date: '2026-06-30',
      beneficiary_account: 'IL620108000000099999999',
      beneficiary_address: 'HaYarkon 99, Tel Aviv, Israel',
      status: 'unpaid',
    },
    {
      invoice_number: 'INV-1004',
      supplier_name: 'Atlas Print & Pack',
      currency: 'EUR',
      amount: 4750.0,
      due_date: '2026-06-20',
      beneficiary_account: 'NL91ABNA0417164300',
      beneficiary_address: 'Keizersgracht 200, 1016 Amsterdam, Netherlands',
      status: 'completed',
      payment_currency: 'ILS',
      payment_amount: 19000.0,
      fx_rate: 4.0,
    },
    {
      invoice_number: 'INV-1005',
      supplier_name: 'Pinewood Office Supplies',
      currency: 'USD',
      amount: 1320.75,
      due_date: '2026-06-18',
      beneficiary_account: 'GB29NWBK60161331926819',
      beneficiary_address: '10 Downing St, London SW1A 2AA, UK',
      status: 'completed',
      payment_currency: 'ILS',
      payment_amount: 4887.0,
      fx_rate: 3.7,
    },
    {
      invoice_number: 'INV-1006',
      supplier_name: 'Cedar Cloud Services',
      currency: 'USD',
      amount: 5600.0,
      due_date: '2026-07-22',
      // Mastercard's DOCUMENTED sandbox test IBAN + address → live account/address validation
      // returns a real 200 SUCCESS/VALID (see the gateway live e2e). Lets the demo show a
      // genuine live Mastercard validation on this invoice.
      beneficiary_account: 'FR070331234567890123456',
      beneficiary_address: '4 CLARK STREET, EVERETT, MA, 02149',
      status: 'unpaid',
    },
  ],

  Employee: [
    {
      full_name: 'Maya Cohen',
      email: 'maya.cohen@fintory.demo',
      department: 'Engineering',
      role: 'Staff Engineer',
      status: 'active',
      monthly_budget_ils: 4000,
    },
    {
      full_name: 'Daniel Levi',
      email: 'daniel.levi@fintory.demo',
      department: 'Sales',
      role: 'Account Executive',
      status: 'active',
      monthly_budget_ils: 6000,
    },
    {
      full_name: 'Noa Friedman',
      email: 'noa.friedman@fintory.demo',
      department: 'Finance',
      role: 'Controller',
      status: 'active',
      monthly_budget_ils: 3000,
    },
    {
      full_name: 'Omar Haddad',
      email: 'omar.haddad@fintory.demo',
      department: 'Marketing',
      role: 'Growth Lead',
      status: 'active',
      monthly_budget_ils: 5000,
    },
  ],

  VirtualCard: [
    {
      card_name: 'Engineering Tools',
      employee_name: 'Maya Cohen',
      card_type: 'team',
      status: 'active',
      last4: '4417',
      expiry: '11/28',
      total_spent_this_month: 2310.5,
    },
    {
      card_name: 'Sales Travel',
      employee_name: 'Daniel Levi',
      card_type: 'personal',
      status: 'active',
      last4: '8902',
      expiry: '03/27',
      total_spent_this_month: 4120.0,
    },
    {
      card_name: 'Marketing Ads',
      employee_name: 'Omar Haddad',
      card_type: 'team',
      status: 'active',
      last4: '1175',
      expiry: '08/29',
      total_spent_this_month: 3890.25,
    },
  ],

  CardTransaction: [
    {
      card_name: 'Engineering Tools',
      merchant_name: 'GitHub',
      merchant_category: 'Software',
      amount: 21.0,
      currency: 'USD',
      status: 'approved',
      transaction_date: '2026-06-25',
    },
    {
      card_name: 'Engineering Tools',
      merchant_name: 'AWS',
      merchant_category: 'Cloud',
      amount: 540.33,
      currency: 'USD',
      status: 'approved',
      transaction_date: '2026-06-24',
    },
    {
      card_name: 'Sales Travel',
      merchant_name: 'Lufthansa',
      merchant_category: 'Travel',
      amount: 880.0,
      currency: 'EUR',
      status: 'approved',
      transaction_date: '2026-06-23',
    },
    {
      card_name: 'Sales Travel',
      merchant_name: 'Hilton Tel Aviv',
      merchant_category: 'Lodging',
      amount: 1450.0,
      currency: 'ILS',
      status: 'approved',
      transaction_date: '2026-06-22',
    },
    {
      card_name: 'Marketing Ads',
      merchant_name: 'Google Ads',
      merchant_category: 'Advertising',
      amount: 1200.0,
      currency: 'USD',
      status: 'approved',
      transaction_date: '2026-06-21',
    },
    {
      card_name: 'Marketing Ads',
      merchant_name: 'Meta',
      merchant_category: 'Advertising',
      amount: 690.25,
      currency: 'USD',
      status: 'approved',
      transaction_date: '2026-06-20',
    },
  ],

  TopUp: [
    {
      account_name: 'Fintory Demo Ltd',
      transfer_method: 'wire',
      amount_ils: 100000,
      date: '2026-06-01',
    },
    {
      account_name: 'Fintory Demo Ltd',
      transfer_method: 'ach',
      amount_ils: 50000,
      date: '2026-06-15',
    },
  ],
};

// The `/dashboard4` and `/invoices-employees` pages read the `*4` entity variants. Populate
// them with the SAME fixtures (stored under their own entity type) so those routed pages
// aren't empty out of the box. (Safe to share the arrays — the store copies each row via
// stripMeta on insert, so there's no shared-reference mutation.)
SEED_DATA.CompanyProfile4 = SEED_DATA.CompanyProfile;
SEED_DATA.Invoice4 = SEED_DATA.Invoice;
