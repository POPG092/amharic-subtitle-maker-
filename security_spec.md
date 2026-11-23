# Security Specification — FidelSub Access Control

## 1. Data Invariants
- Only verified Google-authenticated users (`request.auth != null && request.auth.token.email_verified == true`) can register a `users/{userId}` document, and `userId` must match `request.auth.uid`.
- The bootstrapped owner (`djelawebshet@gmail.com` with `email_verified == true`) is the sole Admin capable of listing all signed-in users, viewing usage logs across users, and changing `accessStatus` (`pending`, `approved`, `blocked`), `videoLimit` (`-1` for unlimited, `0`+ for temporary counts), or resetting `usedCount`.
- Newly signed-in users start with `accessStatus == 'pending'`, `videoLimit == 0`, and `usedCount == 0`.
- Users cannot escalate their own `accessStatus` or `videoLimit`, cannot read another user's `users/{userId}` document, and can only increment `usedCount` by `+1` when `accessStatus == 'approved'` and `usedCount < videoLimit` (or `videoLimit == -1`).
- Every `usageLogs/{logId}` entry must belong to `request.auth.uid`, use server timestamp `request.time`, and can only be created when the user is Admin or has `accessStatus == 'approved'`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read on `/users/{userId}` -> `PERMISSION_DENIED`.
2. Authenticated non-admin `list` on `/users` -> `PERMISSION_DENIED`.
3. Authenticated non-admin `get` on another user's `/users/{otherId}` -> `PERMISSION_DENIED`.
4. Unverified email spoof (`email: "djelawebshet@gmail.com", email_verified: false`) -> `PERMISSION_DENIED`.
5. Self-approval on `create` (`accessStatus: "approved"`, `videoLimit: 99`) -> `PERMISSION_DENIED`.
6. Self-upgrade on `update` (`affectedKeys` includes `accessStatus` or `videoLimit`) -> `PERMISSION_DENIED`.
7. Shadow field injection on `users/{uid}` (`isAdmin: true`) -> `PERMISSION_DENIED`.
8. Usage decrement attack (`usedCount: 0` from `usedCount: 2`) -> `PERMISSION_DENIED`.
9. Oversized document ID (`>128` chars or invalid chars) -> `PERMISSION_DENIED`.
10. Oversized `note` (`>240` chars) or `displayName` (`>120` chars) -> `PERMISSION_DENIED`.
11. Client-forged timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`.
12. `usageLogs` creation by `pending` or `blocked` user -> `PERMISSION_DENIED`.
