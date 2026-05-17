/**
 * Standalone unit-test runner for the webhook pure-logic helpers:
 *   • lib/fawry/status.ts — Fawry status → payment_status mapping
 *   • lib/fawry/signing.ts verifyCallback against fabricated webhook payloads
 *
 * The route handler itself (app/api/fawry/webhook/route.ts) is best exercised
 * end-to-end with a sandbox ngrok replay (slice 5 "Done when…" criterion).
 * No DB-mocking framework in the repo, and adding one isn't worth a single
 * route — so the integration test lives in TEST_DATA.md as a captured payload
 * once we have sandbox credentials.
 *
 * Run with: `npx tsx scripts/fawry-webhook.test.ts`
 */
import { createHash } from 'node:crypto';
import { mapFawryStatus, isFailureBranch } from '../lib/fawry/status';
import { verifyCallback } from '../lib/fawry/signing';
import type {
  FawryOrderStatus,
  FawryServerNotificationV2,
} from '../lib/fawry/types';

// ============================================================================
// Harness — same shape as scripts/fawry-signature.test.ts.
// ============================================================================

interface TestResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function assertEqual<T>(actual: T, expected: T, label = 'value'): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(cond: boolean, label = 'condition'): void {
  if (!cond) throw new Error(`${label}: expected true`);
}

function assertFalse(cond: boolean, label = 'condition'): void {
  if (cond) throw new Error(`${label}: expected false`);
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const money = (n: number | string) => (typeof n === 'string' ? Number(n) : n).toFixed(2);

// ============================================================================
// mapFawryStatus
// ============================================================================

test('mapFawryStatus: PAID → paid', () => {
  assertEqual(mapFawryStatus('PAID'), 'paid');
});

test('mapFawryStatus: FAILED and CANCELED both → failed', () => {
  assertEqual(mapFawryStatus('FAILED'), 'failed');
  assertEqual(mapFawryStatus('CANCELED'), 'failed');
});

test('mapFawryStatus: EXPIRED → expired', () => {
  assertEqual(mapFawryStatus('EXPIRED'), 'expired');
});

test('mapFawryStatus: REFUNDED → refunded', () => {
  assertEqual(mapFawryStatus('REFUNDED'), 'refunded');
});

test('mapFawryStatus: NEW and PARTIAL_REFUNDED are no-ops (null)', () => {
  assertEqual(mapFawryStatus('NEW'), null);
  assertEqual(mapFawryStatus('PARTIAL_REFUNDED'), null);
});

// ============================================================================
// isFailureBranch — drives the order.status='cancelled' transition that
// releases stock via the migration-015 trigger.
// ============================================================================

test('isFailureBranch: true for FAILED, EXPIRED, CANCELED', () => {
  assertTrue(isFailureBranch('FAILED'));
  assertTrue(isFailureBranch('EXPIRED'));
  assertTrue(isFailureBranch('CANCELED'));
});

test('isFailureBranch: false for PAID, REFUNDED, NEW, PARTIAL_REFUNDED', () => {
  const negatives: FawryOrderStatus[] = [
    'PAID',
    'REFUNDED',
    'NEW',
    'PARTIAL_REFUNDED',
  ];
  for (const s of negatives) {
    assertFalse(isFailureBranch(s), `isFailureBranch("${s}")`);
  }
});

// ============================================================================
// Webhook signature round-trip against the wire shape the route handler will
// see. Belt-and-braces over signing.test.ts: those vectors use fabricated
// secrets, these exercise the exact field set the Fawry route validates with
// Zod (and thus the exact concatenation order verifyCallback computes).
// ============================================================================

const KEY = 'TEST_SECURE_KEY';

function makeWebhook(
  overrides: Partial<FawryServerNotificationV2> = {}
): FawryServerNotificationV2 {
  const base: FawryServerNotificationV2 = {
    requestId: 'req-webhook-1',
    fawryRefNumber: 'FAWRY_REF_W1',
    merchantRefNumber: 'ORD-WH-001',
    paymentAmount: 250,
    orderAmount: 240,
    fawryFees: 10,
    orderStatus: 'PAID',
    paymentMethod: 'PAYATFAWRY',
    paymentTime: Date.now(),
    paymentRefrenceNumber: 'PRN-1234',
    messageSignature: '',
    ...overrides,
  };
  base.messageSignature = sha256(
    `${base.fawryRefNumber}${base.merchantRefNumber}` +
      `${money(base.paymentAmount)}${money(base.orderAmount)}` +
      `${base.orderStatus}${base.paymentMethod}` +
      `${base.paymentRefrenceNumber ?? ''}${KEY}`
  );
  return base;
}

test('webhook payload: a freshly signed PAID notification verifies', () => {
  const w = makeWebhook();
  assertTrue(verifyCallback(w, KEY), 'verifyCallback accepts');
});

test('webhook payload: signature is bound to orderStatus', () => {
  // A retry that flips orderStatus from PAID → FAILED without re-signing must
  // be rejected — otherwise an attacker who captured one webhook could forge
  // a different one.
  const w = makeWebhook();
  const tampered: FawryServerNotificationV2 = { ...w, orderStatus: 'FAILED' };
  assertFalse(verifyCallback(tampered, KEY), 'tampered orderStatus rejected');
});

test('webhook payload: signature is bound to merchantRefNumber', () => {
  const w = makeWebhook();
  const tampered: FawryServerNotificationV2 = {
    ...w,
    merchantRefNumber: 'ORD-WH-999',
  };
  assertFalse(verifyCallback(tampered, KEY), 'tampered ref rejected');
});

test('webhook payload: signature is bound to amounts', () => {
  const w = makeWebhook();
  const tampered: FawryServerNotificationV2 = {
    ...w,
    paymentAmount: 1,
  };
  assertFalse(verifyCallback(tampered, KEY), 'tampered amount rejected');
});

test('webhook payload: a PAYATFAWRY notification without paymentRefrenceNumber still verifies', () => {
  // Some sandbox flows omit paymentRefrenceNumber on the success webhook.
  // The signing formula concatenates an empty string in that case.
  const w = makeWebhook({ paymentRefrenceNumber: undefined });
  assertTrue(verifyCallback(w, KEY), 'verify accepts without ref number');
});

// ============================================================================
// Report
// ============================================================================

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

for (const r of results) {
  const mark = r.ok ? '+' : 'x';
  const line = `  ${mark} ${r.name}`;
  if (r.ok) {
    console.log(line);
  } else {
    console.error(line);
    console.error(`      ${r.detail}`);
  }
}

console.log(`\n${passed}/${results.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed === 0 ? 0 : 1);
