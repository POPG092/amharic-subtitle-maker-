import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExpiryIso,
  evaluateSubscriptionState,
  formatPlanLabel,
  TELEBIRR_ACCOUNT_NAME,
  TELEBIRR_PHONE,
  validateTelebirrReference,
} from './subscription';

test('new free user gets exactly 1 free video trial before paywall', () => {
  const fresh = evaluateSubscriptionState({
    plan_type: 'free',
    videos_used: 0,
    is_pro: false,
    pro_expires_at: null,
    payment_status: 'none',
  });
  assert.equal(fresh.canGenerate, true);
  assert.equal(fresh.reason, 'free_trial');
  assert.equal(fresh.remainingFreeVideos, 1);

  const afterFirst = evaluateSubscriptionState({
    plan_type: 'free',
    videos_used: 1,
    is_pro: false,
    pro_expires_at: null,
    payment_status: 'none',
  });
  assert.equal(afterFirst.canGenerate, false);
  assert.equal(afterFirst.reason, 'trial_exhausted');
  assert.equal(afterFirst.remainingFreeVideos, 0);
});

test('monthly and yearly plans automatically expire when pro_expires_at <= now', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');
  const expiredMonthly = evaluateSubscriptionState(
    {
      plan_type: 'monthly',
      videos_used: 5,
      is_pro: true,
      pro_expires_at: '2026-11-23T12:00:00.000Z',
      payment_status: 'approved',
    },
    now,
  );

  assert.equal(expiredMonthly.canGenerate, false);
  assert.equal(expiredMonthly.isProActive, false);
  assert.equal(expiredMonthly.needsExpirationTermination, true);
  assert.equal(expiredMonthly.reason, 'plan_expired');
  assert.deepEqual(expiredMonthly.terminationPatch, {
    is_pro: false,
    plan_type: 'free',
    payment_status: 'none',
  });

  const activeYearly = evaluateSubscriptionState(
    {
      plan_type: 'yearly',
      videos_used: 20,
      is_pro: true,
      pro_expires_at: '2027-05-01T00:00:00.000Z',
      payment_status: 'approved',
    },
    now,
  );
  assert.equal(activeYearly.canGenerate, true);
  assert.equal(activeYearly.isProActive, true);
  assert.equal(activeYearly.needsExpirationTermination, false);
});

test('lifetime pro plan never expires', () => {
  const farFuture = new Date('2045-01-01T00:00:00.000Z');
  const lifetime = evaluateSubscriptionState(
    {
      plan_type: 'lifetime',
      videos_used: 500,
      is_pro: true,
      pro_expires_at: null,
      payment_status: 'approved',
    },
    farFuture,
  );
  assert.equal(lifetime.canGenerate, true);
  assert.equal(lifetime.isProActive, true);
  assert.equal(lifetime.needsExpirationTermination, false);
  assert.equal(computeExpiryIso('lifetime'), null);
});

test('Telebirr account constants and reference validation match specification', () => {
  assert.equal(TELEBIRR_PHONE, '0951084993');
  assert.equal(TELEBIRR_ACCOUNT_NAME, 'Kalab Wubshet');

  assert.equal(validateTelebirrReference('  ').valid, false);
  assert.equal(validateTelebirrReference('123').valid, false);
  assert.equal(validateTelebirrReference('TXN 999!').valid, false);
  const ok = validateTelebirrReference('  B7K910421A  ');
  assert.equal(ok.valid, true);
  assert.equal(ok.cleaned, 'B7K910421A');

  assert.equal(
    formatPlanLabel({
      id: '1',
      email: 'guest@example.com',
      plan_type: 'free',
      videos_used: 1,
      is_pro: false,
      pro_expires_at: null,
      payment_status: 'pending',
    }),
    'Telebirr Payment Pending Approval',
  );
});
