import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isOwnerAccount, type AccessStatus } from './utils/accessControl';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface UserAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  accessStatus: AccessStatus;
  videoLimit: number;
  usedCount: number;
  note: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
  lastSeenAt?: Timestamp | unknown;
}

export interface UsageLogRecord {
  id: string;
  userId: string;
  userEmail: string;
  fileName: string;
  mediaKind: 'video' | 'audio';
  sourceMode: 'auto' | 'amharic' | 'translate';
  cueCount: number;
  createdAt?: Timestamp | unknown;
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Ensures the signed-in user has a registered `users/{uid}` record in Firestore
 * so the owner sees every account that signs in and can control access limits.
 */
export async function syncSignedInUserRecord(user: User): Promise<void> {
  if (!user.uid || !user.email || !user.emailVerified) return;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email.split('@')[0] || 'User').slice(0, 120);
  const photoURL = (user.photoURL || '').slice(0, 500);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!existingSnap.exists()) {
    const owner = isOwnerAccount(user.email, user.emailVerified);
    try {
      await setDoc(userRef, {
        uid: user.uid.slice(0, 128),
        email: user.email.slice(0, 254),
        displayName,
        photoURL,
        accessStatus: owner ? 'approved' : 'pending',
        videoLimit: owner ? -1 : 0,
        usedCount: 0,
        note: owner ? 'Owner account' : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
    return;
  }

  try {
    await updateDoc(userRef, {
      displayName,
      photoURL,
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}
