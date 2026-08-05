/**
 * Renders the Mastercard technical-connectivity report from a run produced by
 * scripts/sandbox-report-run.ts. Emits report.md and report.html from the same
 * data (no markdown dependency); report.pdf is printed from the HTML separately.
 *
 *   npm run sandbox-report:render
 *   npm run sandbox-report:render -- --out=reports/sandbox-connectivity-run
 */
import * as fs from 'fs';
import * as path from 'path';

interface CallRecord {
  seq: number;
  api: string;
  scenario: string;
  transaction_reference?: string;
  method: string;
  url: string;
  request_payload_plain: unknown;
  http_status: number;
  response_payload: unknown;
  response_was_encrypted: boolean;
  timestamp_utc: string;
  duration_ms: number;
}

interface Summary {
  base_url: string;
  auth_mode?: string;
  partner_id: string;
  encryption: string;
  quotes_url: string;
  payment_url: string;
  run_started_utc: string;
  calls: CallRecord[];
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** DD-MM-YYYY — the format used in Mastercard's own reporting template. */
function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

function statusOf(call: CallRecord): string {
  const body = call.response_payload as any;
  return body?.payment?.status ?? body?.quote?.status ?? '';
}

function proposalOf(call: CallRecord): string {
  const body = call.response_payload as any;
  const p = body?.quote?.proposals?.proposal;
  const first = Array.isArray(p) ? p[0] : p;
  return first?.id ?? body?.payment?.proposal_id ?? '';
}

/** The "Response Received" cell, phrased as in Mastercard's template. */
function responseCell(call: CallRecord): string {
  const ok = call.http_status >= 200 && call.http_status < 300;
  if (!ok) return `HTTP ${call.http_status} — see appendix`;
  const st = statusOf(call);
  const detail =
    call.api === 'Payment'
      ? `payment status ${st}`
      : `proposal ${proposalOf(call)}`;
  return `Complete payload received for successful transaction (HTTP ${call.http_status}, ${detail})`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function main(): void {
  const outDir = path.resolve(
    process.cwd(),
    arg('out') ?? 'reports/sandbox-connectivity-run',
  );
  const summary: Summary = JSON.parse(
    fs.readFileSync(path.join(outDir, 'run-summary.json'), 'utf8'),
  );
  const calls = summary.calls;
  const runDate = ddmmyyyy(summary.run_started_utc);
  const ok = calls.filter((c) => c.http_status >= 200 && c.http_status < 300);
  const isPsd2 = /\.xbs\.mastercard\.(eu|uk)$/.test(
    new URL(summary.base_url).hostname,
  );
  const authLabel =
    summary.auth_mode === 'oauth2-request-token'
      ? 'OAuth 2.0 request token (OAUTH2_REQUEST_TOKEN, self-signed JWT)'
      : 'OAuth 1.0a request signing';

  const PARTNER_APP = 'Fintory';
  const TOOL = 'Own developed application (Node.js / NestJS integration client)';

  // ---------------------------------------------------------------- Markdown
  const md: string[] = [];
  md.push(`# Mastercard XBS Implementation by ${PARTNER_APP}`);
  md.push(`## Technical Connectivity Report — ${isPsd2 ? 'PSD2 EU Sandbox' : 'Sandbox'}`);
  md.push('');
  md.push(`| | |`);
  md.push(`| --- | --- |`);
  md.push(`| **Partner / Application** | ${PARTNER_APP} |`);
  md.push(`| **Partner ID used** | \`${summary.partner_id}\` |`);
  md.push(`| **Environment** | Mastercard Cross-Border Services — ${isPsd2 ? 'PSD2 EU Sandbox (MTS EU)' : 'Sandbox'} |`);
  md.push(`| **Report date** | ${runDate} |`);
  md.push(`| **Tool / App Used** | ${TOOL} |`);
  md.push(
    `| **Security** | ${authLabel} + JWE field-level encryption (requests encrypted, responses decrypted) |`,
  );
  md.push(
    `| **Result** | ${ok.length} of ${calls.length} calls returned HTTP 2xx with a complete payload |`,
  );
  md.push('');
  md.push('### URLs used');
  md.push('');
  md.push('```');
  md.push(`Quote API    POST  ${summary.quotes_url}`);
  md.push(`Payment API  POST  ${summary.payment_url}`);
  md.push('```');
  md.push('');
  if (isPsd2) {
    md.push('### Endpoint and authentication');
    md.push('');
    md.push(
      'This run was executed against the **PSD2 EU edge**, using the ' +
        '`OAUTH2_REQUEST_TOKEN` grant as required for customers contracted with ' +
        'MTS EU / MTS UK. Each request carries a self-signed JWT in the ' +
        '`Authorization` header (JOSE header `x5t#S256`, `x5c`, `kid` = our consumer ' +
        'key, `cty: JWS`, `alg: RS256`; claims `nbf`/`exp`/`iat`/`jti`), signed with ' +
        'the same project key pair issued for OAuth 1.0a. Payloads are JWE-encrypted ' +
        'with the same client-encryption keys used on the global endpoints.',
    );
    md.push('');
    md.push(
      'Two points worth confirming with Mastercard, both found while preparing this run:',
    );
    md.push('');
    md.push(
      '- The host we were originally given, `sandbox.api.mastercard.eu` (no `xbs` ' +
        'segment), is not usable: its TLS certificate expired on 26-01-2024 and the ' +
        'Cross-Border routes there return `404 NOT_FOUND`. The working endpoint is ' +
        '`sandbox.api.xbs.mastercard.eu`, which is what this report uses.',
    );
    // Deliberately states only what this run demonstrates. An earlier draft also
    // claimed the Key Management Portal request had been started — that is an
    // organisational fact about our side that this tool cannot observe, and a report
    // to Mastercard must not assert it. Add it back only once it is actually true.
    md.push(
      '- Mutual TLS is not required on the sandbox edge and was therefore not used ' +
        'here; every call in this report completed over ordinary TLS. We understand ' +
        'it becomes mandatory on MTF and production, and would welcome confirmation ' +
        'of the certificate steps expected of us before MTF onboarding.',
    );
  } else {
    md.push('### Endpoint and authentication');
    md.push('');
    md.push(
      'This run used the global Sandbox/MTF endpoint with OAuth 1.0a request ' +
        'signing and JWE payload encryption.',
    );
  }
  md.push('');
  md.push('### Transactions');
  md.push('');
  md.push(
    '| Sr.No | API | Transaction Date | Transaction Reference Number | Response Received |',
  );
  md.push('| --- | --- | --- | --- | --- |');
  calls.forEach((c, i) => {
    md.push(
      `| ${i + 1} | ${c.api} | ${ddmmyyyy(c.timestamp_utc)} | ${c.transaction_reference ?? ''} | ${responseCell(c)} |`,
    );
  });
  md.push('');
  md.push('### Scenarios exercised');
  md.push('');
  md.push('| Sr.No | Scenario | Sandbox test case |');
  md.push('| --- | --- | --- |');
  const testCase: Record<string, string> = {
    'Forward quote, fees included':
      "transaction_reference starts with '08', ends with 'ACFQ', quote_type.forward with fees_included=true",
    'Reverse quote':
      "transaction_reference starts with '08', ends with 'ACRQ', quote_type.reverse",
    'Quote for payment (success flow)':
      "transaction_reference starts with '09' (funds the successful payment)",
    'Payment with quote (success)':
      "same transaction_reference as the '09' quote plus its proposal id",
    'Quote for payment (pending flow)':
      "transaction_reference starts with '06' (funds the pending payment)",
    'Payment with quote (pending)':
      "same transaction_reference as the '06' quote, proposal id, recipient_account_uri ending '10####'",
  };
  calls.forEach((c, i) => {
    md.push(`| ${i + 1} | ${c.scenario} | ${testCase[c.scenario] ?? ''} |`);
  });
  md.push('');
  md.push('---');
  md.push('');
  md.push('## Appendix A — Full request and response payloads');
  md.push('');
  md.push(
    'Request payloads are shown in cleartext, as constructed before JWE encryption. ' +
      'On the wire each request body was encrypted to `{ "encrypted_payload": { "data": "<JWE>" } }` ' +
      'and sent with `x-encrypted: true`. Response payloads are shown as decrypted with our ' +
      'Mastercard encryption private key. The `Authorization` header itself is omitted.',
  );
  md.push('');
  calls.forEach((c, i) => {
    md.push(`### ${i + 1}. ${c.api} — ${c.scenario}`);
    md.push('');
    md.push(`- **Transaction reference:** \`${c.transaction_reference}\``);
    md.push(`- **Endpoint:** \`${c.method} ${c.url}\``);
    md.push(`- **Timestamp (UTC):** ${c.timestamp_utc}`);
    md.push(
      `- **Result:** HTTP ${c.http_status}${statusOf(c) ? `, status ${statusOf(c)}` : ''} (${c.duration_ms} ms)`,
    );
    md.push('');
    md.push('**Request payload**');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(c.request_payload_plain, null, 2));
    md.push('```');
    md.push('');
    md.push('**Response payload**');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(c.response_payload, null, 2));
    md.push('```');
    md.push('');
  });

  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n') + '\n');

  // -------------------------------------------------------------------- HTML
  const rows = calls
    .map(
      (c, i) =>
        `<tr><td>${i + 1}</td><td>${esc(c.api)}</td><td>${ddmmyyyy(c.timestamp_utc)}</td>` +
        `<td class="ref">${esc(c.transaction_reference ?? '')}</td><td>${esc(responseCell(c))}</td></tr>`,
    )
    .join('\n');

  const scenarioRows = calls
    .map(
      (c, i) =>
        `<tr><td>${i + 1}</td><td>${esc(c.scenario)}</td><td>${esc(testCase[c.scenario] ?? '')}</td></tr>`,
    )
    .join('\n');

  const appendix = calls
    .map(
      (c, i) => `
<section class="tx">
  <h3>${i + 1}. ${esc(c.api)} — ${esc(c.scenario)}</h3>
  <ul class="meta">
    <li><b>Transaction reference:</b> <code>${esc(c.transaction_reference ?? '')}</code></li>
    <li><b>Endpoint:</b> <code>${esc(c.method)} ${esc(c.url)}</code></li>
    <li><b>Timestamp (UTC):</b> ${esc(c.timestamp_utc)}</li>
    <li><b>Result:</b> HTTP ${c.http_status}${statusOf(c) ? `, status ${esc(statusOf(c))}` : ''} (${c.duration_ms} ms)</li>
  </ul>
  <p class="lbl">Request payload</p>
  <pre>${esc(JSON.stringify(c.request_payload_plain, null, 2))}</pre>
  <p class="lbl">Response payload</p>
  <pre>${esc(JSON.stringify(c.response_payload, null, 2))}</pre>
</section>`,
    )
    .join('\n');

  const endpointNoteHtml = isPsd2
    ? `<h3>Endpoint and authentication</h3>
<p class="note">This run was executed against the <b>PSD2 EU edge</b>, using the
<code>OAUTH2_REQUEST_TOKEN</code> grant as required for customers contracted with MTS EU / MTS UK.
Each request carries a self-signed JWT in the <code>Authorization</code> header (JOSE header
<code>x5t#S256</code>, <code>x5c</code>, <code>kid</code> = our consumer key, <code>cty: JWS</code>,
<code>alg: RS256</code>; claims <code>nbf</code>/<code>exp</code>/<code>iat</code>/<code>jti</code>),
signed with the same project key pair issued for OAuth 1.0a. Payloads are JWE-encrypted with the same
client-encryption keys used on the global endpoints.</p>
<p class="note">Two points worth confirming with Mastercard, both found while preparing this run:</p>
<ul class="note">
  <li>The host we were originally given, <code>sandbox.api.mastercard.eu</code> (no <code>xbs</code>
      segment), is not usable: its TLS certificate expired on 26-01-2024 and the Cross-Border routes
      there return <code>404 NOT_FOUND</code>. The working endpoint is
      <code>sandbox.api.xbs.mastercard.eu</code>, which is what this report uses.</li>
  <li>Mutual TLS is not required on the sandbox edge and was therefore not used here; every call in
      this report completed over ordinary TLS. We understand it becomes mandatory on MTF and
      production, and would welcome confirmation of the certificate steps expected of us before MTF
      onboarding.</li>
</ul>`
    : `<h3>Endpoint and authentication</h3>
<p class="note">This run used the global Sandbox/MTF endpoint with OAuth 1.0a request signing and JWE
payload encryption.</p>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Mastercard XBS Implementation by ${PARTNER_APP} — Technical Connectivity (Sandbox)</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 18pt; margin: 0 0 2px; color: #14213d; }
  h2 { font-size: 12.5pt; margin: 0 0 18px; color: #5a6172; font-weight: 500; }
  h3 { font-size: 11pt; margin: 22px 0 8px; color: #14213d; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 18px; }
  th, td { border: 1px solid #c9ced8; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { background: #eef1f6; font-weight: 600; }
  td.ref { font-family: Consolas, monospace; font-size: 9pt; white-space: nowrap; }
  table.kv td:first-child { width: 30%; background: #f7f8fb; font-weight: 600; }
  pre { background: #f6f7f9; border: 1px solid #d9dee6; border-radius: 3px; padding: 8px 10px;
        font-family: Consolas, "Courier New", monospace; font-size: 8pt; line-height: 1.35;
        white-space: pre-wrap; word-break: break-word; margin: 4px 0 12px; }
  code { font-family: Consolas, monospace; font-size: 9pt; }
  .lbl { font-weight: 600; margin: 10px 0 2px; font-size: 9.5pt; }
  ul.meta { margin: 4px 0 10px; padding-left: 18px; font-size: 9.5pt; }
  ul.meta li { margin: 2px 0; }
  section.tx { page-break-inside: avoid; }
  hr { border: 0; border-top: 1px solid #c9ced8; margin: 24px 0; }
  .note { font-size: 9.5pt; color: #444; }
</style></head><body>
<h1>Mastercard XBS Implementation by ${PARTNER_APP}</h1>
<h2>Technical Connectivity Report — ${isPsd2 ? 'PSD2 EU Sandbox' : 'Sandbox'}</h2>

<table class="kv">
  <tr><td>Partner / Application</td><td>${PARTNER_APP}</td></tr>
  <tr><td>Partner ID used</td><td><code>${esc(summary.partner_id)}</code></td></tr>
  <tr><td>Environment</td><td>Mastercard Cross-Border Services — ${isPsd2 ? 'PSD2 EU Sandbox (MTS EU)' : 'Sandbox'}</td></tr>
  <tr><td>Report date</td><td>${runDate}</td></tr>
  <tr><td>Tool / App Used</td><td>${TOOL}</td></tr>
  <tr><td>Security</td><td>${authLabel} + JWE field-level encryption (requests encrypted, responses decrypted)</td></tr>
  <tr><td>Result</td><td>${ok.length} of ${calls.length} calls returned HTTP 2xx with a complete payload</td></tr>
</table>

<h3>URLs used</h3>
<pre>Quote API    POST  ${esc(summary.quotes_url)}
Payment API  POST  ${esc(summary.payment_url)}</pre>

${endpointNoteHtml}

<h3>Transactions</h3>
<table>
  <tr><th>Sr.No</th><th>API</th><th>Transaction Date</th><th>Transaction Reference Number</th><th>Response Received</th></tr>
  ${rows}
</table>

<h3>Scenarios exercised</h3>
<table>
  <tr><th>Sr.No</th><th>Scenario</th><th>Sandbox test case</th></tr>
  ${scenarioRows}
</table>

<hr>
<h2 style="font-size:13pt;color:#14213d;font-weight:600;margin-top:0">Appendix A — Full request and response payloads</h2>
<p class="note">Request payloads are shown in cleartext, as constructed before JWE encryption. On the wire each
request body was encrypted to <code>{ "encrypted_payload": { "data": "&lt;JWE&gt;" } }</code> and sent with
<code>x-encrypted: true</code>. Response payloads are shown as decrypted with our Mastercard encryption
private key. The <code>Authorization</code> header itself is omitted.</p>
${appendix}
</body></html>
`;
  fs.writeFileSync(path.join(outDir, 'report.html'), html);

  console.log(`report.md   → ${path.join(outDir, 'report.md')}`);
  console.log(`report.html → ${path.join(outDir, 'report.html')}`);
  console.log(`${ok.length}/${calls.length} calls 2xx`);
}

main();
