import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const gatePath = new URL('../docs/production-launch-gates.json', import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const allowedStatuses = new Set(['blocked', 'pending', 'passed', 'not_applicable']);
const requiredGates = [
  'brand_name_resolution',
  'shopify_store_created',
  'shopify_paid_plan_selected',
  'theme_preview_uploaded',
  'rendered_qa_passed',
  'support_email_verified',
  'approved_products_available',
  'licensed_product_media_available',
  'product_compliance_approved',
  'product_liability_insurance_reviewed',
  'final_prices_approved',
  'inventory_approved',
  'shipping_approved',
  'policies_approved',
  'gst_and_tax_invoice_testing',
  'shopify_payments_verified',
  'paypal_express_verified',
  'test_order_passed',
  'refund_test_passed',
  'dns_access_available',
  'owner_final_authorisation',
];

const failures = [];
const fail = (message) => failures.push(message);
let register;

try {
  register = JSON.parse(await readFile(gatePath, 'utf8'));
} catch (error) {
  console.error(`FAIL production launch-gate register is not readable JSON: ${error.message}`);
  process.exit(1);
}

if (register.schema_version !== '1.0.0') fail('schema_version must be 1.0.0');
if (!Array.isArray(register.allowed_statuses)) fail('allowed_statuses must be an array');
else if (
  register.allowed_statuses.length !== allowedStatuses.size ||
  register.allowed_statuses.some((status) => !allowedStatuses.has(status))
) {
  fail('allowed_statuses must contain only blocked, pending, passed and not_applicable');
}

const release = register.release ?? {};
if (release.repository !== 'bginty/docked') fail('release.repository must identify bginty/docked');
if (release.release_branch !== 'release/docked-shopify-production-2026-08') {
  fail('release.release_branch must identify the required production release branch');
}
if (release.starting_commit !== '895958891c8ec2780eba7ff224c5d0259d0de9dd') {
  fail('release.starting_commit must identify the approved theme commit');
}
if (release.store_handle !== 'cfbexf-h4.myshopify.com') {
  fail('release.store_handle must identify the independently verified cfbexf-h4.myshopify.com store');
}
if (release.public_prelaunch_authorisation_phrase !== 'AUTHORISE_DOCKED_PUBLIC_PRELAUNCH') {
  fail('the public-prelaunch authorisation phrase is incorrect');
}
if (release.full_launch_authorisation_phrase !== 'AUTHORISE_DOCKED_DOMAIN_CUTOVER_AND_LIVE_SALES') {
  fail('the full-launch authorisation phrase is incorrect');
}

for (const gateName of requiredGates) {
  const gate = register[gateName];
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
    fail(`${gateName} is missing or is not an object`);
  }
}

const gates = Object.entries(register).filter(
  ([, value]) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.hasOwn(value, 'status') || Object.hasOwn(value, 'evidence')),
);
const statusCounts = Object.fromEntries([...allowedStatuses].map((status) => [status, 0]));
for (const [gateName, gate] of gates) {
  if (!allowedStatuses.has(gate.status)) {
    fail(`${gateName}.status is invalid`);
    continue;
  }
  statusCounts[gate.status] += 1;
  if (!Object.hasOwn(gate, 'evidence')) fail(`${gateName}.evidence is missing`);
  if (gate.status === 'passed') {
    if (!gate.evidence || typeof gate.evidence !== 'object' || Array.isArray(gate.evidence)) {
      fail(`${gateName} is passed without an evidence object`);
    } else {
      for (const field of ['type', 'observed_at', 'summary', 'reference', 'scope', 'limitations']) {
        if (typeof gate.evidence[field] !== 'string' || !gate.evidence[field].trim()) {
          fail(`${gateName}.evidence.${field} must be a non-empty string for a passed gate`);
        }
      }
      const reference = gate.evidence.reference;
      if (typeof reference === 'string' && reference.includes('/')) {
        const referencePath = path.resolve(repositoryRoot, reference);
        const relativeReference = path.relative(repositoryRoot, referencePath);
        if (relativeReference === '..' || relativeReference.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReference)) {
          fail(`${gateName}.evidence.reference must remain inside the repository`);
        } else {
          try {
            await access(referencePath);
          } catch {
            fail(`${gateName}.evidence.reference does not resolve: ${reference}`);
          }
        }
      }
    }
  }
}

if (register.owner_final_authorisation?.status === 'passed' && release.authorisation_received !== true) {
  fail('owner_final_authorisation cannot pass unless release.authorisation_received is true');
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`Production launch-gate validation failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(
  `PASS production launch-gate register: ${requiredGates.length}/${requiredGates.length} required gates; ` +
    `${gates.length} total gates; ${statusCounts.passed} passed, ${statusCounts.pending} pending, ${statusCounts.blocked} blocked, ` +
    `${statusCounts.not_applicable} not applicable.`,
);
