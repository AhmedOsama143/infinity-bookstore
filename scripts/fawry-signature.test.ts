/**
 * Standalone unit-test runner for lib/fawry/signing.ts.
 *
 * No Vitest/Jest in the repo, and adding one wasn't worth a single suite —
 * this runs via `npm run test:fawry` (tsx). It:
 *   1. Verifies signing.ts produces the documented byte sequence (asserted
 *      against an independent implementation of the SIGNING_REFERENCE.md
 *      formulas, not against a copy of signing.ts).
 *   2. Exercises invariants: optional-field handling, two-decimal money,
 *      lexicographic item sort, case-insensitive verification.
 *   3. Round-trips charge-response, webhook, and refund signatures (sign,
 *      tamper, verify rejects).
 *
 * TODO: when Fawry publishes test vectors with known plaintext + expected
 * signature for the Self-Hosted Checkout Button, replace the independent
 * implementation here with those fixed vectors.
 */
import { createHash } from 'node:crypto';
import {
  signChargeRequest,
  verifyChargeResponse,
  verifyCallback,
  signRefund,
  attachChargeSignature,
  attachRefundSignature,
} from '../lib/fawry/signing';
import type { FawryServerNotificationV2 } from '../lib/fawry/types';

// ============================================================================
// Test harness
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
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond: boolean, label = 'condition'): void {
  if (!cond) throw new Error(`${label}: expected true`);
}

function assertFalse(cond: boolean, label = 'condition'): void {
  if (cond) throw new Error(`${label}: expected false`);
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const money = (n: number) => n.toFixed(2);

// ============================================================================
// Charge request signature — SIGNING_REFERENCE.md §1
// ============================================================================

const KEY = 'TEST_SECURE_KEY';
const MC = 'TEST_MC';

test('charge request: single item, no profile id', () => {
  const sig = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-001',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'BOOK1', quantity: 2, price: 50 }],
    },
    KEY
  );
  const expected = sha256(
    `${MC}ORD-001https://example.com/returnBOOK12${money(50)}${KEY}`
  );
  assertEqual(sig, expected, 'signature');
});

test('charge request: items are sorted by itemId before signing', () => {
  const sig = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-002',
      returnUrl: 'https://example.com/return',
      // Intentionally unsorted: B then A.
      chargeItems: [
        { itemId: 'B', quantity: 1, price: 10 },
        { itemId: 'A', quantity: 3, price: 20 },
      ],
    },
    KEY
  );
  // Canonical order: A then B.
  const expected = sha256(
    `${MC}ORD-002https://example.com/returnA3${money(20)}B1${money(10)}${KEY}`
  );
  assertEqual(sig, expected, 'signature');
});

test('charge request: customerProfileId injected between ref and returnUrl', () => {
  const sig = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-003',
      customerProfileId: 'USER_42',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 99.5 }],
    },
    KEY
  );
  const expected = sha256(
    `${MC}ORD-003USER_42https://example.com/returnX1${money(99.5)}${KEY}`
  );
  assertEqual(sig, expected, 'signature');
});

test('charge request: undefined profile id concatenates as empty string', () => {
  const withUndefined = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-004',
      customerProfileId: undefined,
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 1 }],
    },
    KEY
  );
  const withEmpty = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-004',
      customerProfileId: '',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 1 }],
    },
    KEY
  );
  assertEqual(withUndefined, withEmpty, 'undefined === ""');
});

test('charge request: prices are formatted to two decimals', () => {
  // 99.5 (one decimal) and 99.50 (two decimals) must produce the same signature.
  const a = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-005',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 99.5 }],
    },
    KEY
  );
  const b = signChargeRequest(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-005',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 99.5 }],
    },
    KEY
  );
  assertEqual(a, b, 'signatures match');
  // Independently verify the formula uses .toFixed(2).
  const expected = sha256(`${MC}ORD-005https://example.com/returnX199.50${KEY}`);
  assertEqual(a, expected, 'signature');
});

test('attachChargeSignature: produces a fully-typed signed request', () => {
  const signed = attachChargeSignature(
    {
      merchantCode: MC,
      merchantRefNum: 'ORD-006',
      returnUrl: 'https://example.com/return',
      chargeItems: [{ itemId: 'X', quantity: 1, price: 1 }],
    },
    KEY
  );
  assertTrue(signed.signature.length === 64, 'sha256 hex length');
  assertEqual(signed.merchantRefNum, 'ORD-006', 'fields preserved');
});

// ============================================================================
// Charge response signature — SIGNING_REFERENCE.md §2
// ============================================================================

test('charge response: valid signature accepts', () => {
  const params = {
    referenceNumber: 'FAWRY_REF_1',
    merchantRefNumber: 'ORD-100',
    paymentAmount: 110,
    orderAmount: 100,
    orderStatus: 'PAID',
    paymentMethod: 'CARD',
    fawryFees: 10,
    customerMail: 's@example.com',
    customerMobile: '01000000000',
    signature: '',
  };
  const expected = sha256(
    `FAWRY_REF_1ORD-100${money(110)}${money(100)}PAIDCARD${money(10)}` +
      `s@example.com01000000000${KEY}`
  );
  params.signature = expected;
  assertTrue(verifyChargeResponse(params, KEY), 'verify accepts');
});

test('charge response: tampered amount rejects', () => {
  const params = {
    referenceNumber: 'FAWRY_REF_1',
    merchantRefNumber: 'ORD-101',
    paymentAmount: 110,
    orderAmount: 100,
    orderStatus: 'PAID',
    paymentMethod: 'CARD',
    fawryFees: 10,
    signature: '',
  };
  params.signature = sha256(
    `FAWRY_REF_1ORD-101${money(110)}${money(100)}PAIDCARD${money(10)}${KEY}`
  );
  assertTrue(verifyChargeResponse(params, KEY), 'baseline accepts');

  // Now tamper.
  const tampered = { ...params, paymentAmount: 999 };
  assertFalse(verifyChargeResponse(tampered, KEY), 'tampered rejects');
});

test('charge response: case-insensitive hex compare', () => {
  const params = {
    referenceNumber: '',
    merchantRefNumber: 'ORD-102',
    paymentAmount: 50,
    orderAmount: 50,
    orderStatus: 'PAID',
    paymentMethod: 'CARD',
    signature: '',
  };
  params.signature = sha256(
    `ORD-102${money(50)}${money(50)}PAIDCARD${KEY}`
  ).toUpperCase();
  assertTrue(verifyChargeResponse(params, KEY), 'uppercase hex accepted');
});

// ============================================================================
// Webhook (Server Notification V2) — SIGNING_REFERENCE.md §3
// ============================================================================

function makeWebhook(overrides: Partial<FawryServerNotificationV2> = {}): FawryServerNotificationV2 {
  return {
    requestId: 'req-1',
    fawryRefNumber: 'FAWRY_REF_W1',
    merchantRefNumber: 'ORD-200',
    paymentAmount: 100,
    orderAmount: 100,
    orderStatus: 'PAID',
    paymentMethod: 'PAYATFAWRY',
    paymentRefrenceNumber: 'PRN-9',
    messageSignature: '',
    ...overrides,
  };
}

test('webhook: valid signature accepts', () => {
  const w = makeWebhook();
  w.messageSignature = sha256(
    `${w.fawryRefNumber}${w.merchantRefNumber}${money(w.paymentAmount)}` +
      `${money(w.orderAmount)}${w.orderStatus}${w.paymentMethod}` +
      `${w.paymentRefrenceNumber}${KEY}`
  );
  assertTrue(verifyCallback(w, KEY), 'verify accepts');
});

test('webhook: missing paymentRefrenceNumber concatenates as empty', () => {
  const w = makeWebhook({ paymentRefrenceNumber: undefined });
  w.messageSignature = sha256(
    `${w.fawryRefNumber}${w.merchantRefNumber}${money(w.paymentAmount)}` +
      `${money(w.orderAmount)}${w.orderStatus}${w.paymentMethod}${KEY}`
  );
  assertTrue(verifyCallback(w, KEY), 'verify accepts when ref number absent');
});

test('webhook: tampered orderAmount rejects', () => {
  const w = makeWebhook();
  w.messageSignature = sha256(
    `${w.fawryRefNumber}${w.merchantRefNumber}${money(w.paymentAmount)}` +
      `${money(w.orderAmount)}${w.orderStatus}${w.paymentMethod}` +
      `${w.paymentRefrenceNumber}${KEY}`
  );
  const tampered = { ...w, orderAmount: 1 };
  assertFalse(verifyCallback(tampered, KEY), 'tampered rejects');
});

test('webhook: wrong secure key rejects', () => {
  const w = makeWebhook();
  w.messageSignature = sha256(
    `${w.fawryRefNumber}${w.merchantRefNumber}${money(w.paymentAmount)}` +
      `${money(w.orderAmount)}${w.orderStatus}${w.paymentMethod}` +
      `${w.paymentRefrenceNumber}${KEY}`
  );
  assertFalse(verifyCallback(w, 'WRONG_KEY'), 'wrong key rejects');
});

// ============================================================================
// Refund signature — SIGNING_REFERENCE.md §4
// ============================================================================

test('refund: signature matches formula', () => {
  const sig = signRefund(
    {
      merchantCode: MC,
      fawryRefNumber: 'FAWRY_REF_R1',
      refundAmount: 50,
      reason: 'duplicate order',
    },
    KEY
  );
  const expected = sha256(`${MC}FAWRY_REF_R1${money(50)}duplicate order${KEY}`);
  assertEqual(sig, expected, 'signature');
});

test('refund: no reason concatenates as empty string', () => {
  const sig = signRefund(
    {
      merchantCode: MC,
      fawryRefNumber: 'FAWRY_REF_R2',
      refundAmount: 25.5,
    },
    KEY
  );
  const expected = sha256(`${MC}FAWRY_REF_R2${money(25.5)}${KEY}`);
  assertEqual(sig, expected, 'signature');
});

test('attachRefundSignature: produces a fully-typed signed request', () => {
  const signed = attachRefundSignature(
    {
      merchantCode: MC,
      referenceNumber: 'FAWRY_REF_R3',
      refundAmount: 30,
      reason: 'oversold',
    },
    KEY
  );
  assertTrue(signed.signature.length === 64, 'sha256 hex length');
  assertEqual(signed.referenceNumber, 'FAWRY_REF_R3', 'fields preserved');
});

// ============================================================================
// Report
// ============================================================================

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

for (const r of results) {
  const mark = r.ok ? '✓' : '✗';
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
