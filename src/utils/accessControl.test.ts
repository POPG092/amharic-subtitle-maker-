import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canGenerateSubtitles,
  formatQuotaSummary,
  isOwnerAccount,
  OWNER_EMAIL,
} from './accessControl';

test('isOwnerAccount requires exact verified owner email', () => {
  assert.equal(isOwnerAccount(OWNER_EMAIL, true), true);
  assert.equal(isOwnerAccount('DJELAWEBSHET@GMAIL.COM', true), true);
  assert.equal(isOwnerAccount(OWNER_EMAIL, false), false);
  assert.equal(isOwnerAccount('other@example.com', true), false);
  assert.equal(isOwnerAccount(null, true), false);
});

test('canGenerateSubtitles grants unlimited free access to verified owner', () => {
  const result = canGenerateSubtitles({
    email: OWNER_EMAIL,
    emailVerified: true,
    accessStatus: 'pending',
    videoLimit: 0,
    usedCount: 50,
  });
  assert.equal(result.isOwner, true);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 'unlimited');
});

test('canGenerateSubtitles blocks pending, blocked, and exhausted temporary users', () => {
  const pending = canGenerateSubtitles({
    email: 'guest@example.com',
    emailVerified: true,
    accessStatus: 'pending',
    videoLimit: 0,
    usedCount: 0,
  });
  assert.equal(pending.allowed, false);
  assert.equal(pending.remaining, 0);

  const blocked = canGenerateSubtitles({
    email: 'guest@example.com',
    emailVerified: true,
    accessStatus: 'blocked',
    videoLimit: 5,
    usedCount: 0,
  });
  assert.equal(blocked.allowed, false);

  const tempTwo = canGenerateSubtitles({
    email: 'guest@example.com',
    emailVerified: true,
    accessStatus: 'approved',
    videoLimit: 2,
    usedCount: 1,
  });
  assert.equal(tempTwo.allowed, true);
  assert.equal(tempTwo.remaining, 1);

  const exhausted = canGenerateSubtitles({
    email: 'guest@example.com',
    emailVerified: true,
    accessStatus: 'approved',
    videoLimit: 2,
    usedCount: 2,
  });
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.remaining, 0);
});

test('formatQuotaSummary displays clean status text for each tier', () => {
  assert.equal(formatQuotaSummary({ email: OWNER_EMAIL, emailVerified: true }), 'Owner · Free Unlimited');
  assert.equal(
    formatQuotaSummary({ email: 'a@b.com', emailVerified: true, accessStatus: 'pending' }),
    'Pending Approval',
  );
  assert.equal(
    formatQuotaSummary({
      email: 'a@b.com',
      emailVerified: true,
      accessStatus: 'approved',
      videoLimit: 2,
      usedCount: 1,
    }),
    '1 of 2 videos left',
  );
  assert.equal(
    formatQuotaSummary({
      email: 'a@b.com',
      emailVerified: true,
      accessStatus: 'approved',
      videoLimit: -1,
      usedCount: 4,
    }),
    'Unlimited · 4 used',
  );
});
