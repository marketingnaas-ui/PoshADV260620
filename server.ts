import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp as initializeFirebaseApp, getApps, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc, terminate, setLogLevel, type Firestore } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

dotenv.config();
setLogLevel('silent');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const HMR_PORT = Number(process.env.VITE_HMR_PORT || PORT + 10000);
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app-state.json');
const STORE_DIR = path.join(DATA_DIR, 'store');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const JWT_SECRET = process.env.JWT_SECRET || 'clearadvance-prod-secret-2024';

// Enable large JSON bodies for base64 image uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(cookieParser());

// Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  let token = req.cookies.auth_token || req.query.token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};

const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User context missing' });
    
    const masterUsers = await readStore<any[]>('master-users', []);
    const user = masterUsers.find(u => u.id === userId);
    if (!user || user.status === 'ปิดใช้งาน') return res.status(403).json({ error: 'User not found or disabled' });

    // For demo/prototype, we might still check roles, but production should check specific permissions
    // In this app, roles have permissions arrays
    const roles = await readStore<any[]>('roles', []);
    const userRole = roles.find(r => r.name === user.role);
    console.log(`Checking permission ${permission} for user ${user.id} (${user.name}) with role ${user.role}`);
    
    if (user.role === 'Administrator' || user.role === 'Executive' || user.role === 'Accounting' || user.role === 'ฝ่ายบัญชี') return next();
    
    if (userRole && userRole.permissions && userRole.permissions.includes(permission)) {
      return next();
    }

    console.log(`Permission ${permission} denied for user ${user.id}`);
    res.status(403).json({ error: `Permission denied: ${permission}` });
  };
};

async function logAudit(req: any, action: string, refDoc: string, status: 'SUCCESS' | 'FAILED', before?: any, after?: any) {
  try {
    const logs = await readStore<any[]>('audit-logs', []);
    const newLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      channel: 'Web App',
      actor: req.user?.name || 'System',
      actorId: req.user?.id || 'system',
      method: req.method,
      action,
      refDoc,
      status,
      before: before ? JSON.stringify(before) : undefined,
      after: after ? JSON.stringify(after) : undefined,
      ip: req.ip
    };
    logs.unshift(newLog);
    await writeStore('audit-logs', logs.slice(0, 5000)); // Keep last 5000 logs
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}

type PersistedState = {
  advances: any[];
  settings: Record<string, boolean>;
  running_numbers: Record<string, { year: number, month?: number, count: number }>;
};

type StoredFileRecord = {
  id: string;
  fileName: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  relatedId?: string;
  relatedType?: string;
  source?: string;
  createdAt: string;
  url: string;
  isImage: boolean;
  storagePath?: string;
  driveFileId?: string;
  driveUrl?: string;
};

const DEFAULT_STATE: PersistedState = {
  advances: [],
  settings: {},
  running_numbers: {}
};

type FirebaseResources = {
  app: FirebaseApp;
  db: Firestore;
  storage: FirebaseStorage | null;
};

// Safely load config from firebase-applet-config.json if present
let appletConfigFromFile: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    appletConfigFromFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('🔥 Successfully parsed firebase-applet-config.json for premium Firestore connectivity!');
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || appletConfigFromFile.apiKey || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || appletConfigFromFile.authDomain || '',
  projectId: process.env.FIREBASE_PROJECT_ID || appletConfigFromFile.projectId || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || appletConfigFromFile.storageBucket || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || appletConfigFromFile.messagingSenderId || '',
  appId: process.env.FIREBASE_APP_ID || appletConfigFromFile.appId || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || appletConfigFromFile.measurementId || '',
  firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || appletConfigFromFile.firestoreDatabaseId || ''
};

let firebaseResources: FirebaseResources | null = null;
let firebaseLastError = '';
let firebaseRetryAfter = 0;

function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

function getFirebaseResources() {
  if (!isFirebaseConfigured()) return null;
  if (!firebaseResources) {
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeFirebaseApp(FIREBASE_CONFIG);
      let storageInstance: FirebaseStorage | null = null;
      try {
        if (FIREBASE_CONFIG.storageBucket) {
          storageInstance = getStorage(app);
        }
      } catch (storageErr) {
        console.warn('Firebase Storage is currently not available or is unconfigured in this project. Error details:', storageErr);
      }
      firebaseResources = {
        app,
        db: FIREBASE_CONFIG.firestoreDatabaseId 
          ? getFirestore(app, FIREBASE_CONFIG.firestoreDatabaseId)
          : getFirestore(app),
        storage: storageInstance
      };
    } catch (dbError) {
      markFirebaseError(dbError);
      return null;
    }
  }
  return firebaseResources;
}

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function markFirebaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  firebaseLastError = message;
  firebaseRetryAfter = Date.now() + 60_000;
  console.warn(`Firebase persistence unavailable, using local persistent store: ${message}`);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('permission') || message.includes('insufficient')) {
    const errInfo: FirestoreErrorInfo = {
      error: message,
      authInfo: {
        userId: 'server-side-express',
      },
      operationType,
      path
    };
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
  markFirebaseError(error);
}

async function withFirebaseTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 15_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function firebaseStoreDoc(key: string) {
  const resources = getFirebaseResources();
  if (!resources) return null;
  const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
  return doc(resources.db, 'clearadvanceStores', safeKey);
}

function firebaseStateDoc() {
  const resources = getFirebaseResources();
  if (!resources) return null;
  return doc(resources.db, 'clearadvanceApp', 'state');
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
}

function storeFile(key: string) {
  const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
  return path.join(STORE_DIR, `${safeKey}.json`);
}

function readLocalStore<T>(key: string, fallback: T): T {
  ensureDatabase();
  const file = storeFile(key);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStore<T>(key: string, value: T): T {
  ensureDatabase();
  fs.writeFileSync(storeFile(key), JSON.stringify(value, null, 2), 'utf8');
  return value;
}

function readLocalState(): PersistedState {
  ensureDatabase();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    advances: Array.isArray(parsed.advances) ? parsed.advances : DEFAULT_STATE.advances,
    settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : DEFAULT_STATE.settings,
    running_numbers: parsed.running_numbers && typeof parsed.running_numbers === 'object' ? parsed.running_numbers : DEFAULT_STATE.running_numbers
  };
}

function writeLocalState(nextState: Partial<PersistedState>) {
  const current = readLocalState();
  const safeState: PersistedState = {
    advances: Array.isArray(nextState.advances) ? nextState.advances : current.advances,
    settings: nextState.settings && typeof nextState.settings === 'object' ? nextState.settings : current.settings,
    running_numbers: nextState.running_numbers && typeof nextState.running_numbers === 'object' ? nextState.running_numbers : current.running_numbers
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(safeState, null, 2), 'utf8');
  return safeState;
}

async function readStore<T>(key: string, fallback: T): Promise<T> {
  const storeDoc = firebaseStoreDoc(key);
  if (!storeDoc) return readLocalStore(key, fallback);

  try {
    const snapshot = await withFirebaseTimeout(getDoc(storeDoc), `Firestore read store ${key}`);
    if (snapshot.exists()) {
      firebaseLastError = '';
      const data = snapshot.data();
      return (data.records !== undefined ? data.records : fallback) as T;
    }

    const seed = readLocalStore(key, fallback);
    await withFirebaseTimeout(setDoc(storeDoc, {
      records: sanitizeForFirestore(seed),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), `Firestore seed store ${key}`);
    firebaseLastError = '';
    return seed;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `clearadvanceStores/${key}`);
    const msg = error instanceof Error ? error.message : String(error);
    if (FIREBASE_CONFIG.firestoreDatabaseId) {
      console.warn(`⚠️ Custom Firestore database ID "${FIREBASE_CONFIG.firestoreDatabaseId}" is offline or unavailable (Error/Timeout: ${msg}). Falling back immediately to default database "(default)" to avoid disruption...`);
      const brokenDb = firebaseResources?.db;
      FIREBASE_CONFIG.firestoreDatabaseId = '';
      firebaseResources = null; // force rebuild resource on next call
      if (brokenDb) {
        terminate(brokenDb).catch(() => {}); // Stop background streams
      }
      return readStore(key, fallback);
    }
    markFirebaseError(error);
    throw new Error(`Fatal Firestore Read Error: ${msg} - Prevented fallback to local storage to avoid data loss.`);
  }
}

async function writeStore<T>(key: string, value: T): Promise<T> {
  const storeDoc = firebaseStoreDoc(key);
  if (!storeDoc) {
    writeLocalStore(key, value);
    return value;
  }

  try {
    await withFirebaseTimeout(setDoc(storeDoc, {
      records: sanitizeForFirestore(value),
      updatedAt: serverTimestamp()
    }, { merge: true }), `Firestore write store ${key}`);
    firebaseLastError = '';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clearadvanceStores/${key}`);
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`⚠️ Firestore write failed for key ${key}: ${msg}`);
    if (FIREBASE_CONFIG.firestoreDatabaseId) {
      console.warn(`⚠️ Custom Firestore database ID "${FIREBASE_CONFIG.firestoreDatabaseId}" is offline or unavailable (Error/Timeout during write: ${msg}). Falling back immediately to default database "(default)" to avoid disruption...`);
      const brokenDb = firebaseResources?.db;
      FIREBASE_CONFIG.firestoreDatabaseId = '';
      firebaseResources = null; // force rebuild resource on next call
      if (brokenDb) {
        terminate(brokenDb).catch(() => {}); // Stop background streams
      }
      return writeStore(key, value);
    }
    markFirebaseError(error);
    throw new Error(`Fatal Firestore Write Error: ${msg} - Prevented fallback to local storage to ensure data durability.`);
  }
}

async function readState(): Promise<PersistedState> {
  const stateDoc = firebaseStateDoc();
  if (!stateDoc) return readLocalState();

  try {
    const snapshot = await withFirebaseTimeout(getDoc(stateDoc), 'Firestore read app state');
    if (snapshot.exists()) {
      firebaseLastError = '';
      const data = snapshot.data();
      const state = {
        advances: Array.isArray(data.advances) ? data.advances : DEFAULT_STATE.advances,
        settings: data.settings && typeof data.settings === 'object' ? data.settings : DEFAULT_STATE.settings,
        running_numbers: data.running_numbers && typeof data.running_numbers === 'object' ? data.running_numbers : DEFAULT_STATE.running_numbers
      } as PersistedState;
      writeLocalState(state);
      return state;
    }

    const seed = readLocalState();
    await withFirebaseTimeout(setDoc(stateDoc, {
      ...sanitizeForFirestore(seed),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), 'Firestore seed app state');
    firebaseLastError = '';
    return seed;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'clearadvanceApp/state');
    const msg = error instanceof Error ? error.message : String(error);
    if (FIREBASE_CONFIG.firestoreDatabaseId) {
      console.warn(`⚠️ Custom Firestore database ID "${FIREBASE_CONFIG.firestoreDatabaseId}" is offline or unavailable (Error/Timeout during state read: ${msg}). Falling back immediately to default database "(default)" to avoid disruption...`);
      const brokenDb = firebaseResources?.db;
      FIREBASE_CONFIG.firestoreDatabaseId = '';
      firebaseResources = null; // force rebuild resource on next call
      if (brokenDb) {
        terminate(brokenDb).catch(() => {}); // Stop background streams
      }
      return readState();
    }
    markFirebaseError(error);
    throw new Error(`Fatal Firestore Read Error: ${msg} - Prevented fallback to local storage to avoid data loss.`);
  }
}

async function writeState(nextState: Partial<PersistedState>): Promise<PersistedState> {
  const current = await readState();
  const safeState: PersistedState = {
    advances: Array.isArray(nextState.advances) ? nextState.advances : current.advances,
    settings: nextState.settings && typeof nextState.settings === 'object' ? nextState.settings : current.settings,
    running_numbers: nextState.running_numbers && typeof nextState.running_numbers === 'object' ? nextState.running_numbers : current.running_numbers
  };
  const stateDoc = firebaseStateDoc();
  if (stateDoc) {
    try {
      await withFirebaseTimeout(setDoc(stateDoc, {
        ...sanitizeForFirestore(safeState),
        updatedAt: serverTimestamp()
      }, { merge: true }), 'Firestore write app state');
      firebaseLastError = '';
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'clearadvanceApp/state');
      const msg = error instanceof Error ? error.message : String(error);
      if (FIREBASE_CONFIG.firestoreDatabaseId) {
        console.warn(`⚠️ Custom Firestore database ID "${FIREBASE_CONFIG.firestoreDatabaseId}" is offline or unavailable (Error/Timeout during state write: ${msg}). Falling back immediately to default database "(default)" to avoid disruption...`);
        const brokenDb = firebaseResources?.db;
        FIREBASE_CONFIG.firestoreDatabaseId = '';
        firebaseResources = null; // force rebuild resource on next call
        if (brokenDb) {
          terminate(brokenDb).catch(() => {}); // Stop background streams
        }
        return writeState(nextState);
      }
      markFirebaseError(error);
      throw new Error(`Fatal Firestore Write Error: ${msg} - Prevented fallback to local storage to ensure data durability.`);
    }
  } else {
    writeLocalState(safeState);
  }
  return safeState;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function recordsToCsv(headers: string[], rows: Record<string, unknown>[]) {
  return '\uFEFF' + [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n');
}

function advancesToCsv(advances: PersistedState['advances']) {
  const headers = [
    'Status',
    'ADV_No',
    'Request_Date',
    'Due_Date',
    'Requester_Name',
    'Project_Name',
    'Source_Bank_Name',
    'Source_Account_Name',
    'Source_Account_No',
    'Recipient_Bank_Name',
    'Recipient_Account_No',
    'CLR_No',
    'Ref_ADV_No',
    'Item_Date',
    'Vendor_Name',
    'Tax_ID',
    'Receipt_No',
    'Tax_Invoice_No',
    'Item_Description',
    'Amount_Net',
    'VAT_Amount',
    'Discount_Amount',
    'Other_Cost',
    'Total_Amount',
    'Total_Requested',
    'Total_Cleared',
    'Outstanding_Balance'
  ];

  const rows: string[][] = [];

  const cleanText = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/,/g, ' ').replace(/;/g, ' ').replace(/\|/g, ' ').trim();
  };

  const cleanNum = (val: any): string => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    return String(Math.round(num));
  };

  const cleanAccountNo = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/[-\s]/g, '');
  };

  const resolveStatusLabel = (status: string, outstanding: number) => {
    if (outstanding > 0) return 'รอเคลียร์ยอด';
    if (status === 'PENDING_APPROVAL') return 'รออนุมัติ';
    if (status === 'WAITING_TRANSFER') return 'รอโอน';
    if (status === 'WAITING_CLEARANCE') return 'รอเคลียร์';
    if (status === 'CLOSED') return 'ปิดยอด';
    if (status === 'REJECTED') return 'ไม่อนุมัติ';
    if (status === 'DRAFT' || status === 'บันทึกร่าง') return 'บันทึกร่าง';
    return status;
  };

  advances.forEach(r => {
    const totalRequested = r.amount;
    const totalCleared = r.clrAmount || 0;
    const outstandingBalance = Math.max(0, totalRequested - totalCleared);
    const displayStatus = resolveStatusLabel(r.status, outstandingBalance);

    const pay = (r.pay || {}) as any;
    const sourceBank = pay.senderBank || 'ธนาคารไทยพาณิชย์ (SCB)';
    const sourceAccName = pay.senderName || 'บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)';
    const sourceAccNo = cleanAccountNo(pay.senderAccountNo || '0230128490');

    const recipientBank = r.payeeBank || 'ธนาคารกสิกรไทย (KBANK)';
    const recipientAccNo = cleanAccountNo(r.payeeBankNo || '0429384910');

    // Collect receipts from r.receipts and clrs
    const receiptsSet = new Map<string, any>();
    if (r.receipts && r.receipts.length > 0) {
      r.receipts.forEach((rc: any) => {
        receiptsSet.set(rc.id, rc);
      });
    }
    if (r.clrs && r.clrs.length > 0) {
      r.clrs.forEach((clr: any) => {
        if (clr.receipts && clr.receipts.length > 0) {
          clr.receipts.forEach((rc: any) => {
            receiptsSet.set(rc.id || clr.id, { ...rc, id: rc.id || clr.id });
          });
        }
      });
    }

    if (receiptsSet.size > 0) {
      receiptsSet.forEach((rc) => {
        const items = rc.items || [];
        if (items.length > 0) {
          items.forEach((item: any) => {
            const amtNet = item.price * item.qty;
            const vatAmt = Math.round((amtNet * (item.vat || 0)) / 100);
            const totalAmt = amtNet + vatAmt;

            rows.push([
              displayStatus,
              r.id,
              r.reqDate,
              r.dueDate,
              r.empName,
              r.pName,
              sourceBank,
              sourceAccName,
              sourceAccNo,
              recipientBank,
              recipientAccNo,
              rc.id || 'CLR-PENDING',
              r.id,
              rc.date || r.reqDate,
              rc.vendor || '–',
              rc.taxId || '–',
              rc.receiptNo || '–',
              rc.invoiceNo || '–',
              item.desc || '–',
              cleanNum(amtNet),
              cleanNum(vatAmt),
              '0', // Discount
              '0', // Other_Cost
              cleanNum(totalAmt),
              cleanNum(totalRequested),
              cleanNum(totalCleared),
              cleanNum(outstandingBalance)
            ].map(cleanText));
          });
        } else {
          rows.push([
            displayStatus,
            r.id,
            r.reqDate,
            r.dueDate,
            r.empName,
            r.pName,
            sourceBank,
            sourceAccName,
            sourceAccNo,
            recipientBank,
            recipientAccNo,
            rc.id || 'CLR-PENDING',
            r.id,
            rc.date || r.reqDate,
            rc.vendor || '–',
            rc.taxId || '–',
            rc.receiptNo || '–',
            rc.invoiceNo || '–',
            r.desc || '–',
            cleanNum(rc.subtotal || rc.netTotal || 0),
            cleanNum(rc.vatAmount || 0),
            '0',
            '0',
            cleanNum(rc.netTotal || rc.subtotal || 0),
            cleanNum(totalRequested),
            cleanNum(totalCleared),
            cleanNum(outstandingBalance)
          ].map(cleanText));
        }
      });
    } else if (r.clrs && r.clrs.length > 0) {
      r.clrs.forEach((clr: any) => {
        rows.push([
          displayStatus,
          r.id,
          r.reqDate,
          r.dueDate,
          r.empName,
          r.pName,
          sourceBank,
          sourceAccName,
          sourceAccNo,
          recipientBank,
          recipientAccNo,
          clr.id || 'CLR-PENDING',
          r.id,
          clr.date || r.reqDate,
          '–',
          '–',
          '–',
          '–',
          clr.note || r.desc || '–',
          cleanNum(clr.amount),
          '0',
          '0',
          '0',
          cleanNum(clr.amount),
          cleanNum(totalRequested),
          cleanNum(totalCleared),
          cleanNum(outstandingBalance)
        ].map(cleanText));
      });
    } else {
      // Leave empty/defaults
      rows.push([
        displayStatus,
        r.id,
        r.reqDate,
        r.dueDate,
        r.empName,
        r.pName,
        sourceBank,
        sourceAccName,
        sourceAccNo,
        recipientBank,
        recipientAccNo,
        '', // CLR_No
        '', // Ref_ADV_No
        '', // Item_Date
        '', // Vendor_Name
        '', // Tax_ID
        '', // Receipt_No
        '', // Tax_Invoice_No
        '', // Item_Description
        '0', // Amount_Net
        '0', // VAT_Amount
        '0', // Discount_Amount
        '0', // Other_Cost
        '0', // Total_Amount
        cleanNum(totalRequested),
        cleanNum(totalCleared),
        cleanNum(outstandingBalance)
      ].map(cleanText));
    }
  });

  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => row.map(csvEscape).join(','))
  ];
  return '\uFEFF' + lines.join('\n');
}

function safeFileName(fileName: string) {
  const base = path.basename(fileName || 'attachment.bin');
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'attachment.bin';
}

function fileExtFromMime(mimeType: string) {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'text/csv') return '.csv';
  if (mimeType.includes('spreadsheet')) return '.xlsx';
  if (mimeType.includes('wordprocessingml')) return '.docx';
  if (mimeType.startsWith('image/')) return '.jpg';
  return '.bin';
}

function decodeUpload(body: any) {
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
  const dataUrlMatch = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = String(body?.mimeType || dataUrlMatch?.[1] || 'application/octet-stream');
  const base64Data = String(body?.base64Data || dataUrlMatch?.[2] || '');
  if (!base64Data) throw new Error('Missing base64 upload payload');
  return { mimeType, buffer: Buffer.from(base64Data, 'base64') };
}

// Shared lazy-loaded Gemini AI client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      console.warn('⚠️ GEMINI_API_KEY is not defined or is placeholder. OCR API will return a configuration error.');
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiInstance;
}

async function generateDocumentNumber(type: string): Promise<string> {
  const state = await readState();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, '0');
  
  // Scan state.advances to find maximum count for any document of type ADV, CLR, SAV with current YYMM
  let maxCount = 0;
  const advances = Array.isArray(state.advances) ? state.advances : [];
  for (const adv of advances) {
    const idsToCheck = [adv.id];
    if (Array.isArray(adv.clrs)) {
      for (const clr of adv.clrs) {
        if (clr.id) idsToCheck.push(clr.id);
      }
    }
    for (const rawId of idsToCheck) {
      if (!rawId || typeof rawId !== 'string') continue;
      const parts = rawId.split('-');
      if (parts.length >= 3) {
        const yymmPart = parts[1]; // e.g. "2606" or "2026"
        const isTargetMatch = yymmPart === `${yy}${mm}` || yymmPart === `${year}${mm}`;
        if (isTargetMatch) {
          const countPart = parts[parts.length - 1];
          const countNum = parseInt(countPart, 10);
          if (!isNaN(countNum) && countNum > maxCount) {
            maxCount = countNum;
          }
        }
      }
    }
  }

  const nextCount = maxCount + 1;
  state.running_numbers = state.running_numbers || {};
  state.running_numbers['shared'] = { year, month, count: nextCount };
  await writeState(state);

  const formattedCount = String(nextCount).padStart(3, '0');
  return `${type}-${yy}${mm}-${formattedCount}`;
}

async function generateEmployeeCode(): Promise<string> {
  const masterUsers = await readStore<any[]>('master-users', []);
  const now = new Date();
  const year = now.getFullYear();
  const prefix = `SEM-${year}-`;
  
  let maxCount = 0;
  for (const u of masterUsers) {
    if (u.id && typeof u.id === 'string' && u.id.startsWith(prefix)) {
      const parts = u.id.split('-');
      const countPart = parts[parts.length - 1];
      const countNum = parseInt(countPart, 10);
      if (!isNaN(countNum) && countNum > maxCount) {
        maxCount = countNum;
      }
    }
  }
  
  const nextCount = maxCount + 1;
  const state = await readState();
  state.running_numbers = state.running_numbers || {};
  state.running_numbers['employee'] = { year, count: nextCount };
  await writeState(state);

  const formattedCount = String(nextCount).padStart(3, '0');
  return `SEM-${year}-${formattedCount}`;
}

async function generateProjectCode(projectName: string, overridePrefix?: string): Promise<string> {
  const prefix = (overridePrefix || projectName.substring(0, 3)).toUpperCase();
  const state = await readState();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, '0');
  
  const masterProjects = await readStore<any[]>('master-projects', []);
  let maxCount = 0;
  const targetPrefix = `${prefix}-${yy}${mm}-`;
  const targetPrefixLong = `${prefix}-${year}${mm}-`;
  
  for (const p of masterProjects) {
    const rawId = p.id || p.code;
    if (rawId && typeof rawId === 'string' && (rawId.startsWith(targetPrefix) || rawId.startsWith(targetPrefixLong))) {
      const parts = rawId.split('-');
      const countPart = parts[parts.length - 1];
      const countNum = parseInt(countPart, 10);
      if (!isNaN(countNum) && countNum > maxCount) {
        maxCount = countNum;
      }
    }
  }
  
  const nextCount = maxCount + 1;
  state.running_numbers = state.running_numbers || {};
  state.running_numbers[`project_${prefix}`] = { year, count: nextCount };
  await writeState(state);

  const formattedCount = String(nextCount).padStart(3, '0');
  return `${prefix}-${yy}${mm}-${formattedCount}`;
}

// -----------------------------------------------------------------------------
// SECURE BACKEND API ENDPOINTS
// -----------------------------------------------------------------------------

// API Health Check
app.get('/api/health', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const storeExists = fs.existsSync(STORE_DIR);
    const uploadExists = fs.existsSync(UPLOAD_DIR);
    
    // Check if we can read master users
    const masterUsers = await readStore<any[]>('master-users', []);
    
    const firebaseConfigured = isFirebaseConfigured();
    const firebaseAvailable = firebaseConfigured && !firebaseLastError;
    const storageBucket = FIREBASE_CONFIG.storageBucket || null;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      firebaseConfigured,
      firebaseAvailable,
      storageBucket,
      firebaseLastError: firebaseLastError || null,
      services: {
        storage: storeExists && uploadExists ? 'healthy' : 'degraded',
        ocr_provider: ai ? 'configured' : 'not_configured',
        database: masterUsers.length > 0 ? 'online' : 'initializing',
        environment: process.env.NODE_ENV || 'development',
        firebase: {
          configured: firebaseConfigured,
          available: firebaseAvailable,
          projectId: FIREBASE_CONFIG.projectId || null
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/generate-running-number', requireAuth, async (req, res) => {
  try {
    const { type } = req.body;
    if (!['ADV', 'CLR', 'SAV'].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }
    const number = await generateDocumentNumber(type);
    res.json({ number });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate document number' });
  }
});

app.post('/api/generate-employee-code', requireAuth, requirePermission('settings.manage'), async (req, res) => {
  try {
    const code = await generateEmployeeCode();
    res.json({ code });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate employee code' });
  }
});

app.post('/api/generate-project-code', requireAuth, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { projectName, overridePrefix } = req.body;
    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const code = await generateProjectCode(projectName, overridePrefix);
    res.json({ code });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate project code' });
  }
});

app.get('/api/state', requireAuth, async (_req, res) => {
  try {
    res.json(await readState());
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'State read failed' });
  }
});

app.put('/api/state', requireAuth, async (req, res) => {
  try {
    const oldState = await readState();
    const newState = req.body || {};
    
    // State Machine Validation (Task 10) & Document Tracking (Task 11)
    if (newState.advances && oldState.advances) {
      for (let i = 0; i < newState.advances.length; i++) {
        const newAdv = newState.advances[i];
        const oldAdv = oldState.advances.find((a: any) => a.id === newAdv.id);
        
        if (oldAdv && oldAdv.status !== newAdv.status) {
          // Log transition
          await logAudit(req, 'UPDATE_STATUS', newAdv.id, 'SUCCESS', { status: oldAdv.status }, { status: newAdv.status });
          
          // Task 11: Auto-create/update Document Tracking
          if (newAdv.status === 'ACCOUNTING_REVIEW' || newAdv.status === 'READY_TO_CLOSE') {
            if (!newAdv.trackingRecord) {
              console.log(`📑 Initializing Document Tracking for ${newAdv.id}`);
              newAdv.trackingRecord = {
                id: `TRK-${newAdv.id}`,
                status: 'Not Started',
                documents: [
                  { id: 'DOC1', name: 'Original Receipt/Tax Invoice', attached: false, physical: false, receivedDate: null },
                  { id: 'DOC2', name: 'Company Requisition Form', attached: true, physical: false, receivedDate: null }
                ],
                timeline: [{ date: new Date().toISOString(), action: 'Tracking Initialized', status: 'waiting' }],
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              };
            }
          }
        }
      }
    }

    const result = await writeState(newState);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'State save failed' });
  }
});

/**
 * Handles the automated notification logic
 */
async function handleAutomatedLineNotification(advance: any) {
  const config = await readStore<any>('line-messaging-config', null);
  
  if (!config) {
    console.warn('❌ LINE Automation Skipped: No configuration found.');
    return;
  }
  if (!config.automationEnabled) {
    console.warn('❌ LINE Automation Skipped: automationEnabled is toggle OFF.');
    return;
  }
  if (!config.groupId) {
    console.warn('❌ LINE Automation Skipped: Target Group ID is missing.');
    return;
  }
  if (!config.channelAccessToken) {
    console.warn('❌ LINE Automation Skipped: Channel Access Token is missing.');
    return;
  }

  const message = '🟢 [Approved] รายการ {doc_ref} ของคุณได้รับการอนุมัติแล้ว\nยอดเงิน: ฿{amount}\nเข้าบัญชี: {bank_no}'
    .replace('{doc_ref}', advance.id || 'N/A')
    .replace('{amount}', advance.amount?.toLocaleString() || '0')
    .replace('{bank_no}', advance.payeeBankNo || 'N/A')
    .replace('{name}', advance.empName || 'N/A');

  console.log(`💬 Preparing LINE message for ${config.groupId}: ${message.substring(0, 30)}...`);
  await pushLineMessage(config.groupId, message);
}

app.post('/api/state/reset', requireAuth, requirePermission('settings.manage'), async (_req, res) => {
  try {
    res.json(await writeState(DEFAULT_STATE));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'State reset failed' });
  }
});

app.post('/api/store/clear-all', requireAuth, requirePermission('settings.manage'), async (_req, res) => {
  try {
    // 1. Reset main state (advances, settings)
    await writeState(DEFAULT_STATE);
    
    // 2. Clear stores
    const storesToClear = ['files', 'vault-docs', 'ocr-scans', 'clearance-actions', 'review-transactions'];
    for (const storeKey of storesToClear) {
      await writeStore(storeKey, []);
    }
    
    // 3. Optional: Clear uploaded files locally
    const uploadFiles = fs.readdirSync(UPLOAD_DIR);
    for (const file of uploadFiles) fs.unlinkSync(path.join(UPLOAD_DIR, file));
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clear data' });
  }
});

app.get('/api/export/advances.csv', requireAuth, requirePermission('export.data'), async (_req, res) => {
  const csv = advancesToCsv((await readState()).advances);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`clearadvance-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

app.get('/api/export/advance/:id.json', async (req, res) => {
  const state = await readState();
  const advance = state.advances.find(item => item.id === req.params.id);
  if (!advance) return res.status(404).json({ error: 'Advance not found' });
  const payload = {
    exportedAt: new Date().toISOString(),
    database: isFirebaseConfigured() && !firebaseLastError ? 'firebase' : 'local-persistent',
    advance
  };
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.attachment(`${advance.id}-advance-request.json`);
  res.send(JSON.stringify(payload, null, 2));
});

app.get('/api/export/app-backup.json', requireAuth, requirePermission('export.data'), async (_req, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    state: await readState(),
    database: {
      backend: isFirebaseConfigured() ? 'firebase' : 'local',
      projectId: FIREBASE_CONFIG.projectId || null,
      storageBucket: FIREBASE_CONFIG.storageBucket || null
    },
    stores: {
      files: await readStore<StoredFileRecord[]>('files', []),
      vaultDocs: await readStore<any[]>('vault-docs', []),
      ocrScans: await readStore<any[]>('ocr-scans', []),
      clearanceActions: await readStore<any[]>('clearance-actions', []),
      reviewTransactions: await readStore<any[]>('review-transactions', [])
    }
  };
  res.header('Content-Type', 'application/json; charset=utf-8');
  res.attachment(`clearadvance-backup-${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(backup, null, 2));
});

app.get('/api/export/vault-docs.csv', requireAuth, requirePermission('export.data'), async (_req, res) => {
  const docs = await readStore<any[]>('vault-docs', []);
  const files = await readStore<StoredFileRecord[]>('files', []);
  const rows = [
    ...docs.map(doc => ({
      id: doc.id,
      advId: doc.advId,
      clrId: doc.clrId,
      date: doc.date,
      type: doc.type,
      fileName: doc.fileName,
      status: doc.status,
      fileId: doc.fileId || ''
    })),
    ...files.map(file => ({
      id: file.id,
      advId: file.relatedId || '',
      clrId: '',
      date: file.createdAt.slice(0, 10),
      type: file.relatedType || 'ATTACHMENT',
      fileName: file.originalName,
      status: 'Uploaded',
      fileId: file.id
    }))
  ];
  const csv = recordsToCsv(['id', 'advId', 'clrId', 'date', 'type', 'fileName', 'status', 'fileId'], rows);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`vault-docs-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

app.get('/api/export/accounting-ledger.csv', requireAuth, requirePermission('export.data'), async (_req, res) => {
  const rows = await readStore<Record<string, unknown>[]>('review-transactions', []);
  const headers = [
    'advNo', 'clrNo', 'employee', 'project', 'category', 'vendor', 'taxId',
    'docType', 'docNo', 'docDate', 'desc', 'qty', 'unit', 'price', 'lineTotal',
    'subtotal', 'vatAmount', 'whtAmount', 'netAmount', 'approvedAmount',
    'rejectedAmount', 'rejectReason', 'transferBank', 'transferDate',
    'transferRef', 'ocrScore', 'aiTrustScore'
  ];
  const csv = recordsToCsv(headers, rows);
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`accounting-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

app.get('/api/files', requireAuth, async (req, res) => {
  const records = await readStore<StoredFileRecord[]>('files', []);
  const relatedId = typeof req.query.relatedId === 'string' ? req.query.relatedId : '';
  const relatedType = typeof req.query.relatedType === 'string' ? req.query.relatedType : '';
  res.json(records.filter(file =>
    (!relatedId || file.relatedId === relatedId) &&
    (!relatedType || file.relatedType === relatedType)
  ));
});

app.post('/api/files', requireAuth, requirePermission('file.upload'), async (req, res) => {
  try {
    const { mimeType, buffer } = decodeUpload(req.body);
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'File is larger than 15MB' });
    }

    const originalName = safeFileName(String(req.body?.fileName || 'attachment'));
    const ext = path.extname(originalName) || fileExtFromMime(mimeType);
    const id = `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const storedName = `${id}${ext}`;
    const resources = getFirebaseResources();
    let storagePath: string | undefined;
    
    if (resources && resources.storage) {
      const candidateStoragePath = `clearadvance/uploads/${storedName}`;
      try {
        await withFirebaseTimeout(uploadBytes(ref(resources.storage, candidateStoragePath), buffer, { contentType: mimeType }), 'Firebase Storage upload', 25_000);
        storagePath = candidateStoragePath;
      } catch (error) {
        // Only log if it's not a known common environment issue, otherwise just warn silently
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('storage/unknown')) {
          console.log('ℹ️ Firebase Storage upload failed or timed out, falling back to local disk storage safely');
        }
        fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
      }
    } else {
      fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
    }

    const record: StoredFileRecord = {
      id,
      fileName: originalName,
      originalName,
      storedName,
      mimeType,
      size: buffer.byteLength,
      relatedId: typeof req.body?.relatedId === 'string' ? req.body.relatedId : undefined,
      relatedType: typeof req.body?.relatedType === 'string' ? req.body.relatedType : undefined,
      source: typeof req.body?.source === 'string' ? req.body.source : undefined,
      createdAt: new Date().toISOString(),
      url: `/api/files/${id}/download`,
      isImage: mimeType.startsWith('image/'),
      storagePath
    };

    // Trigger Google Drive automatic upload in the background
    uploadToGoogleDrive(originalName, mimeType, buffer).then(driveFileId => {
      if (driveFileId) {
        readStore<StoredFileRecord[]>('files', []).then(async currentFiles => {
          const updated = currentFiles.map(f => f.id === id ? { 
            ...f, 
            driveFileId, 
            driveUrl: `https://drive.google.com/file/d/${driveFileId}/view` 
          } : f);
          await writeStore('files', updated);
          console.log(`💚 File "${originalName}" is linked to Google Drive ID: ${driveFileId}`);
        }).catch(err => {
          console.error('⚠️ Failed to save Google Drive metadata to store:', err);
        });
      }
    }).catch(err => {
      console.warn('⚠️ Automated Google Drive upload background failure:', err);
    });

    const files = await readStore<StoredFileRecord[]>('files', []);
    await writeStore('files', [record, ...files]);
    res.status(201).json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Upload failed' });
  }
});

app.get('/api/files/:id/download', requireAuth, async (req, res) => {
  const records = await readStore<StoredFileRecord[]>('files', []);
  const record = records.find(file => file.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'File not found' });

  if (record.storagePath) {
    try {
      const resources = getFirebaseResources();
      if (resources) {
        const downloadUrl = await withFirebaseTimeout(getDownloadURL(ref(resources.storage, record.storagePath)), 'Firebase Storage download URL', 15_000);
        const fileResponse = await fetch(downloadUrl);
        if (fileResponse.ok) {
          const arrayBuffer = await fileResponse.arrayBuffer();
          const disposition = req.query.download === '1' ? 'attachment' : 'inline';
          res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(record.originalName)}"`);
          return res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch (storageErr) {
      console.warn(`⚠️ Firebase Storage download or configuration error for ${record.id}, using local disk fallback:`, storageErr);
    }
  }

  const uploadRoot = path.resolve(UPLOAD_DIR);
  const absoluteFile = path.resolve(uploadRoot, record.storedName);
  if (!absoluteFile.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(absoluteFile)) {
    return res.status(404).json({ error: 'Stored file missing' });
  }

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(record.originalName)}"`);
  res.sendFile(absoluteFile);
});

app.get('/api/store/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  let fallback: any = [];
  if (key === 'approval-matrix') fallback = { signatureOwner: 'วิภา ทองสุข', autoApproveThreshold: 5000 };

  try {
    const data = await readStore(key, fallback);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Store read failed' });
  }
});

app.put('/api/store/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    let data = req.body;
    console.log(`💾 PUT /api/store/${key} received data length: ${Array.isArray(data) ? data.length : 'unknown'}`);

    // Task 4: PIN Hashing for master-users
    if (key === 'master-users' && Array.isArray(data)) {
      const oldUsers = await readStore<any[]>('master-users', []);
      for (let i = 0; i < data.length; i++) {
        const newUser = data[i];
        const oldUser = oldUsers.find(u => u.id === newUser.id);
        
        // If PIN is provided as plain text and is different from old pin (or old user doesn't have pinHash)
        if (newUser.pin && (!oldUser || oldUser.pin !== newUser.pin)) {
          console.log(`🔐 Hashing new PIN for user: ${newUser.id}`);
          newUser.pinHash = await bcrypt.hash(newUser.pin, 10);
        }
      }
    }

    const result = await writeStore(key, data);
    await logAudit(req, 'UPDATE_STORE', key, 'SUCCESS');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Store write failed' });
  }
});

// Helper function to call Gemini API with retry logic for transient/overloaded errors
async function generateContentWithRetry(ai: any, params: any, maxAttempts = 4, delayMs = 1500) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const errMsg = err.message || String(err);
      const isTransient = errMsg.includes('503') || 
                          errMsg.includes('UNAVAILABLE') || 
                          errMsg.includes('high demand') || 
                          errMsg.includes('overloaded') || 
                          errMsg.includes('resource exhausted') ||
                          errMsg.includes('429');
      if (isTransient && attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 500);
        const nextDelay = (delayMs * attempt) + jitter;
        console.log(`⚠️ Gemini API transient error (attempt ${attempt}/${maxAttempts}). Retrying in ${nextDelay}ms... Error: ${errMsg}`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Secure Server-Side Gemini API Proxy for Receipt OCR Analysis
app.post('/api/gemini/analyze-receipt', requireAuth, async (req, res) => {
  try {
    const { base64Data, mimeType, fileName } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        success: false,
        requiresConfiguration: true,
        errorMessage: 'GEMINI_API_KEY is not configured. Add a real key to .env and restart the server before running OCR.'
      });
    }

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing base64Data or mimeType for receipt image analysis' });
    }

    // Call real schema-guaranteed Gemini model cascade
    console.log(`🤖 Invoking Gemini API secure OCR on: ${fileName || 'unnamed_receipt'}`);
    
    const parts: any[] = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      {
        text: `Analyze this receipt or tax invoice. Parse all details accurately into the requested JSON schema.
If any text is written in Thai, translate or translit relevant vendor/item tags if helpful, but keep names accurate.
Categorize each item correctly as one of: C01, C02, C03, C04, C05.
Invoice date must be in YYYY-MM-DD format.`
      }
    ];

    const modelCandidates = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let responseText: string | null = null;
    let selectedModel = '';
    let errors: string[] = [];

    for (const modelName of modelCandidates) {
      try {
        console.log(`🤖 Attempting Receipt OCR with model: ${modelName}`);
        const response = await generateContentWithRetry(ai, {
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['vendor', 'taxId', 'invoiceNo', 'receiptNo', 'date', 'items'],
              properties: {
                vendor: { type: Type.STRING, description: 'The contractor, company, store, or vendor name' },
                taxId: { type: Type.STRING, description: '13-digit Thai corporate taxpayer ID if found, otherwise any tax ID' },
                invoiceNo: { type: Type.STRING, description: 'Invoice number or blank if not found' },
                receiptNo: { type: Type.STRING, description: 'Receipt number or bill reference' },
                date: { type: Type.STRING, description: 'Invoice/Receipt issue date in standard YYYY-MM-DD format' },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ['desc', 'qty', 'unit', 'price', 'vat', 'wht', 'category'],
                    properties: {
                      desc: { type: Type.STRING, description: 'Description of item or material line item' },
                      qty: { type: Type.NUMBER, description: 'Quantity (default 1)' },
                      unit: { type: Type.STRING, description: 'Unit name (e.g. ตัน, กล่อง, เส้น, ชิ้น)' },
                      price: { type: Type.NUMBER, description: 'Unit price in THB excluding VAT' },
                      vat: { type: Type.NUMBER, description: 'VAT percentage (usually 7 or 0)' },
                      wht: { type: Type.NUMBER, description: 'Withholding tax percentage if any (usually 3, 1, or 0)' },
                      category: { 
                        type: Type.STRING, 
                        description: 'One of: C01 (Labor & Services), C02 (Materials & Equipment), C03 (Transportation & Logistics), C04 (Utilities & System Installation), C05 (Miscellaneous)'
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (response.text?.trim()) {
          responseText = response.text.trim();
          selectedModel = modelName;
          console.log(`✅ Success with Receipt OCR using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`⚠️ Receipt OCR model ${modelName} failed or overloaded: ${err.message || err}`);
        errors.push(`${modelName}: ${err.message || String(err)}`);
      }
    }

    if (!responseText) {
      console.warn("❌ All Gemini AI models experienced issues. No fallback in production.");
      return res.status(503).json({
        success: false,
        ocrStatus: 'OCR_FAILED',
        errorMessage: 'Gemini AI service is currently unavailable. Please enter receipt details manually.'
      });
    }

    const parsedJson = JSON.parse(responseText.trim());
    return res.json({
      success: true,
      isFallback: false,
      data: parsedJson
    });

  } catch (error: any) {
    console.error('❌ Secure Gemini OCR execution failed:', error);
    return res.status(500).json({
      success: false,
      errorOccurred: true,
      errorMessage: error.message || 'Gemini OCR failed'
    });
  }
});

// Secure Server-Side Gemini API Proxy for Bank Slip OCR Analysis
app.post('/api/gemini/analyze-slip', requireAuth, async (req, res) => {
  try {
    const { fileId, advanceId } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        success: false,
        requiresConfiguration: true,
        errorMessage: 'GEMINI_API_KEY is not configured. Add a real key to .env and restart the server before running OCR.'
      });
    }

    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId for slip analysis' });
    }

    // Load file buffer
    const records = await readStore<StoredFileRecord[]>('files', []);
    const record = records.find(file => file.id === fileId);
    if (!record) {
      return res.status(404).json({ error: `File record ${fileId} not found` });
    }

    let buffer: Buffer | null = null;
    if (record.storagePath) {
      try {
        const resources = getFirebaseResources();
        if (resources) {
          const downloadUrl = await withFirebaseTimeout(getDownloadURL(ref(resources.storage, record.storagePath)), 'Firebase Storage download URL', 15_000);
          const fileResponse = await fetch(downloadUrl);
          if (fileResponse.ok) {
            const arrayBuffer = await fileResponse.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }
        }
      } catch (storageErr) {
        console.warn(`⚠️ Firebase Storage read for slip failed, falling back to local file:`, storageErr);
      }
    }

    if (!buffer) {
      const uploadRoot = path.resolve(UPLOAD_DIR);
      const absoluteFile = path.resolve(uploadRoot, record.storedName);
      if (!absoluteFile.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(absoluteFile)) {
        return res.status(404).json({ error: `Attached file binary for ${fileId} not found` });
      }
      buffer = fs.readFileSync(absoluteFile);
    }

    // Call real schema-guaranteed Gemini model cascade
    console.log(`🤖 Invoking Gemini API secure bank slip OCR on: ${fileId} (${record.fileName})`);
    
    const parts: any[] = [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: record.mimeType
        }
      },
      {
        text: `Analyze this bank transfer slip (สลิปโอนเงิน). Extract transfer details accurately.
Ensure you read the ACTUAL transfer details on the image. Do not invent any values.
Return the exact values (e.g. sender bank, sender account number, sender account name, receiver bank, receiver account number, receiver account name, transaction reference number/refNo, amount, date in YYYY-MM-DD, and time in HH:MM).`
      }
    ];

    const modelCandidates = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let responseText: string | null = null;
    let selectedModel = '';
    let errors: string[] = [];

    for (const modelName of modelCandidates) {
      try {
        console.log(`🤖 Attempting Bank Slip OCR with model: ${modelName}`);
        const response = await generateContentWithRetry(ai, {
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: [
                'senderBank', 'senderAccountNo', 'senderName',
                'receiverBank', 'receiverAccountNo', 'receiverName',
                'refNo', 'amount', 'date', 'time'
              ],
              properties: {
                senderBank: { type: Type.STRING, description: 'Sender bank name (e.g. SCB, KBANK, BBL, Krungthai, GSB, TTB etc.)' },
                senderAccountNo: { type: Type.STRING, description: 'Sender bank account number (often 023-X-XXXXX-X or similar)' },
                senderName: { type: Type.STRING, description: 'Sender account display name (often company or person name)' },
                receiverBank: { type: Type.STRING, description: 'Receiver bank name (e.g. KBANK, SCB, KKP, BBL, GSB etc.)' },
                receiverAccountNo: { type: Type.STRING, description: 'Receiver bank account number' },
                receiverName: { type: Type.STRING, description: 'Receiver account display name' },
                refNo: { type: Type.STRING, description: 'Transaction processing reference number / Ref No' },
                amount: { type: Type.NUMBER, description: 'Exact amount of money transferred in THB' },
                date: { type: Type.STRING, description: 'Date of transfer in YYYY-MM-DD format' },
                time: { type: Type.STRING, description: 'Time of transfer in HH:MM format' }
              }
            }
          }
        });

        if (response.text?.trim()) {
          responseText = response.text.trim();
          selectedModel = modelName;
          console.log(`✅ Success with Bank Slip OCR using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`⚠️ Bank Slip OCR model ${modelName} failed or overloaded: ${err.message || err}`);
        errors.push(`${modelName}: ${err.message || String(err)}`);
      }
    }

    if (!responseText) {
      console.warn("❌ All Gemini AI models experienced issues or API errors. No fallback in production.");
      return res.status(503).json({
        success: false,
        ocrStatus: 'OCR_FAILED',
        errorMessage: 'Gemini AI service for Bank Slip analysis is currently unavailable. Please check the slip details manually.'
      });
    }

    const parsedJson = JSON.parse(responseText.trim());
    return res.json({
      success: true,
      data: parsedJson
    });

  } catch (error: any) {
    console.error('❌ Secure Gemini Slip OCR execution failed:', error);
    return res.status(500).json({
      success: false,
      errorOccurred: true,
      errorMessage: error.message || 'Gemini Slip OCR failed'
    });
  }
});

// -----------------------------------------------------------------------------
// SECURE GOOGLE SHEETS API AND OAUTH INTEGRATION ENDPOINTS
// -----------------------------------------------------------------------------

function getGoogleClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID || appletConfigFromFile?.client_id || appletConfigFromFile?.web?.client_id || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || appletConfigFromFile?.client_secret || appletConfigFromFile?.web?.client_secret || '';
  const projectId = process.env.GOOGLE_PROJECT_ID || appletConfigFromFile?.project_id || appletConfigFromFile?.web?.project_id || '';
  return { clientId, clientSecret, projectId };
}

// Simple helper to fetch refreshed access token
async function getGoogleAccessToken(): Promise<string> {
  const tokenRecord = await readStore<any>('google-oauth-token', null);
  if (!tokenRecord || !tokenRecord.refresh_token) {
    throw new Error('Google account is not connected. Please go to Settings > Google Sheets Sync to sign in.');
  }

  const { clientId, clientSecret } = getGoogleClientCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth Credentials are not configured in .env or config file.');
  }

  // Check if token is expired (giving a 5 minute buffer)
  const isExpired = !tokenRecord.expiresAt || Date.now() > (tokenRecord.expiresAt - 300000);
  if (!isExpired && tokenRecord.access_token) {
    return tokenRecord.access_token;
  }

  console.log('🔄 Access token is expired or expiring soon. Refreshing token...');

  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', tokenRecord.refresh_token);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token refresh failed from Google: ${errText}`);
    }

    const data = (await res.json()) as any;
    const expiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
    
    const updatedToken = {
      ...tokenRecord,
      access_token: data.access_token,
      expiresAt,
      expires_in: data.expires_in
    };

    await writeStore('google-oauth-token', updatedToken);
    console.log('💚 Access token refreshed successfully!');
    return data.access_token;
  } catch (err: any) {
    console.error('❌ Google token refresh error:', err);
    throw new Error(`Failed to refresh Google OAuth token: ${err.message}`);
  }
}

// Automatically upload file to Google Drive using Google Drive API
async function uploadToGoogleDrive(fileName: string, mimeType: string, buffer: Buffer): Promise<string | null> {
  try {
    const accessToken = await getGoogleAccessToken().catch(() => null);
    if (!accessToken) {
      console.log('ℹ️ Google Drive sync is not connected. Skipping automatic Drive upload.');
      return null;
    }

    const metadata = {
      name: fileName,
      mimeType: mimeType
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n';

    const mediaPartHeader = delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n';

    const base64Data = buffer.toString('base64');
    const body = Buffer.concat([
      Buffer.from(metadataPart, 'utf8'),
      Buffer.from(mediaPartHeader, 'utf8'),
      Buffer.from(base64Data, 'utf8'),
      Buffer.from(closeDelimiter, 'utf8')
    ]);

    console.log(`📡 Starting Google Drive automatic upload for "${fileName}"...`);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length)
      },
      body: body
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Failed to upload file to Google Drive:', errText);
      return null;
    }

    const driveFile = await response.json() as any;
    console.log('💚 Successfully uploaded file to Google Drive:', driveFile.id, driveFile.name);
    return driveFile.id;
  } catch (error) {
    console.error('⚠️ Google Drive automatic upload error:', error);
    return null;
  }
}

// Generate Auth URL
app.get('/api/google/auth-url', (req, res) => {
  const { clientId } = getGoogleClientCredentials();
  if (!clientId) {
    return res.status(503).json({
      error: 'Google OAuth Client ID is missing. Set GOOGLE_CLIENT_ID in your configuration.'
    });
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  // Standard redirect back to this server's callback endpoint.
  const redirectUri = `${protocol}://${host}/api/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent' // Forces consent screen to always request refresh_token
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.json({ url });
});

// Explicit code exchange endpoint (for manual pasting support)
app.post('/api/google/exchange-code', async (req, res) => {
  const { code, manualRedirectUri } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const { clientId, clientSecret } = getGoogleClientCredentials();
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'Google OAuth Client credentials not loaded' });
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  // Use user-supplied manual endpoint, or default server endpoint.
  const redirectUri = manualRedirectUri || `${protocol}://${host}/api/google/callback`;

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Authorization exchange failed: ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    
    // Fetch user info to store context
    let email = 'connected-user@google.com';
    try {
      const emailRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (emailRes.ok) {
        const emailData = (await emailRes.json()) as any;
        email = emailData.email || email;
      }
    } catch {
      // Non-blocking fallback
    }

    const expiresAt = Date.now() + (Number(tokenData.expires_in || 3600) * 1000);
    const storedToken = {
      ...tokenData,
      email,
      expiresAt
    };

    await writeStore('google-oauth-token', storedToken);
    return res.json({ success: true, email });
  } catch (err: any) {
    console.error('❌ Manual Exchange failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

// OAuth Callback handling
app.get('/api/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.send('<h3>Error: Missing authorization code from Google redirect</h3>');
  }

  const { clientId, clientSecret } = getGoogleClientCredentials();
  if (!clientId || !clientSecret) {
    return res.send('<h3>Error: Google Client credentials are not registered in .env</h3>');
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const redirectUri = `${protocol}://${host}/api/google/callback`;

  try {
    const params = new URLSearchParams();
    params.append('code', String(code));
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`OAuth token exchange error from Google: ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    let email = 'OAuth Account';
    
    // retrieve user email
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as any;
        email = profile.email || email;
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch google user email:', err);
    }

    const expiresAt = Date.now() + (Number(tokenData.expires_in || 3600) * 1000);
    const savedToken = {
      ...tokenData,
      email,
      expiresAt
    };

    await writeStore('google-oauth-token', savedToken);

    // Render simple close popup page
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Sheets Sync Connected</title>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b; }
          .card { padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; max-width: 400px; width: 100%; border: 1px solid #e2e8f0; }
          h2 { color: #10b981; margin-top: 0; }
          p { color: #64748b; line-height: 1.5; font-size: 14px; }
          .btn { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 15px; }
          .btn:hover { background: #059669; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✓ เชื่อมต่อสำเร็จ!</h2>
          <p>เข้าสู่ระบบ Google Sheets Sync เรียบร้อยแล้วด้วยบัญชี <strong>\${email}</strong></p>
          <p>หน้าต่างนี้จะปิดตัวลงโดยอัตโนมัติภายใน 2 วินาที...</p>
          <button class="btn" onclick="wrapUp()">ปิดหน้าต่าง</button>
        </div>
        <script>
          function wrapUp() {
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', email: '\${email}' }, '*');
              }
            } catch (e) {
              console.error(e);
            }
            window.close();
          }
          setTimeout(wrapUp, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('❌ Google OAuth callback processing failed:', err);
    return res.send(`
      <div style="font-family: sans-serif; max-width: 500px; margin: 40px auto; padding: 20px; border: 1px solid #fca5a5; background-color: #fef2f2; border-radius: 8px;">
        <h3 style="color: #dc2626; margin-top:0;">การเชื่อมต่อล้มเหลว</h3>
        <p>\${err.message}</p>
        <p>คุณสามารถลองวาง Authorization Code ได้โดยตรงที่ระบบหลัก</p>
        <p><a href="/#/settings/google-sheets">กลับสู่หน้าถอนการซิงก์กุมหลัก</a></p>
      </div>
    `);
  }
});

// GET status
app.get('/api/google/status', async (req, res) => {
  try {
    const creds = getGoogleClientCredentials();
    const tokenRecord = await readStore<any>('google-oauth-token', null);
    if (!tokenRecord) {
      return res.json({ connected: false, hasUiCredentials: !!creds.clientId });
    }
    return res.json({
      connected: true,
      hasUiCredentials: !!creds.clientId,
      email: tokenRecord.email || 'connected-user@google.com',
      expiresAt: tokenRecord.expiresAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DISCONNECT
app.post('/api/google/disconnect', async (req, res) => {
  try {
    await writeStore('google-oauth-token', null);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper to push values/rows directly into Google sheet tab
async function pushGoogleSheetRows(spreadsheetId: string, sheetTabName: string, values: any[][]) {
  const token = await getGoogleAccessToken();
  
  // 1. Try to clear existing contents first (A1:Z10000) to perform clean overwrite
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/'\${sheetTabName}'!A1:Z10000:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer \${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.warn('⚠️ Clear range non-blocking error (possibly fresh sheet):', e);
  }

  // 2. Perform write / update
  const makeUpdateCall = async () => {
    return fetch(`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/'\${sheetTabName}'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer \${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `'\${sheetTabName}'!A1`,
        majorDimension: 'ROWS',
        values: values
      })
    });
  };

  let updateRes = await makeUpdateCall();

  // If tab is missing, Google returns NOT_FOUND (400 or 404)
  if (!updateRes.ok) {
    const errText = await updateRes.clone().text();
    if (errText.includes('not found') || errText.includes('range') || updateRes.status === 400 || updateRes.status === 404) {
      console.log(`📌 Google Sheet Tab "\${sheetTabName}" is missing. Creating tag in spreadsheet...`);
      // Add sheet tab
      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer \${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTabName
                }
              }
            }
          ]
        })
      });

      if (!batchRes.ok) {
        const batchErr = await batchRes.text();
        throw new Error(`Failed to create Sheet tab "\${sheetTabName}": \${batchErr}`);
      }

      // Retry update
      updateRes = await makeUpdateCall();
    }
  }

  if (!updateRes.ok) {
    const finalErr = await updateRes.text();
    throw new Error(`Failed to update Google Sheet: \${finalErr}`);
  }

  console.log(`💚 Successfully synced \${values.length} rows to tab "\${sheetTabName}"`);
}

// FORCE SYNC ALL
app.post('/api/google/sync-sheets', async (req, res) => {
  try {
    const state = await readState();
    const advances = state.advances || [];

    // 1. Get configs
    const sheetsConfigs = await readStore<any[]>('google-sheets-sync', []);
    if (sheetsConfigs.length === 0) {
      return res.status(400).json({ error: 'Please configure Google Sheets URLs in settings mapping first.' });
    }

    const syncDetails: any[] = [];

    // Compile advances headers & rows
    const fileHeaders = [
      'Status', 'ADV_No', 'Request_Date', 'Due_Date', 'Requester_Name', 'Project_Name',
      'Source_Bank_Name', 'Source_Account_Name', 'Source_Account_No',
      'Recipient_Bank_Name', 'Recipient_Account_No',
      'CLR_No', 'Ref_ADV_No', 'Item_Date', 'Vendor_Name', 'Tax_ID',
      'Receipt_No', 'Tax_Invoice_No', 'Item_Description', 'Amount_Net', 'VAT_Amount',
      'Discount_Amount', 'Other_Cost', 'Total_Amount', 'Total_Requested', 'Total_Cleared',
      'Outstanding_Balance'
    ];

    const cleanText = (val: any): string => {
      if (val === undefined || val === null) return '';
      return String(val).replace(/,/g, ' ').replace(/;/g, ' ').replace(/\|/g, ' ').trim();
    };

    const cleanNum = (val: any): string => {
      if (val === undefined || val === null) return '0';
      const num = Number(val) || 0;
      return String(Math.round(num));
    };

    const cleanAccountNo = (val: any): string => {
      if (val === undefined || val === null) return '';
      return String(val).replace(/[-\s]/g, '');
    };

    const resolveStatusLabel = (status: string, outstanding: number) => {
      if (outstanding > 0) return 'รอเคลียร์ยอด';
      if (status === 'PENDING_APPROVAL') return 'รออนุมัติ';
      if (status === 'WAITING_TRANSFER') return 'รอโอน';
      if (status === 'WAITING_CLEARANCE') return 'รอเคลียร์';
      if (status === 'CLOSED') return 'ปิดยอด';
      if (status === 'REJECTED') return 'ไม่อนุมัติ';
      if (status === 'DRAFT' || status === 'บันทึกร่าง') return 'บันทึกร่าง';
      return status;
    };

    // Synthesize table rows
    const advancesRows: any[][] = [fileHeaders];
    const clearanceRows: any[][] = [fileHeaders];
    const employeeRowsSet = new Map<string, any[]>();

    advances.forEach(r => {
      const totalRequested = r.amount;
      const totalCleared = r.clrAmount || 0;
      const outstandingBalance = Math.max(0, totalRequested - totalCleared);
      const displayStatus = resolveStatusLabel(r.status, outstandingBalance);

      const pay = (r.pay || {}) as any;
      const sourceBank = pay.senderBank || 'ธนาคารไทยพาณิชย์ (SCB)';
      const sourceAccName = pay.senderName || 'บมจ. เจนเซรัล แฟคเตอร์ริ่ง (กองกลางบริษัท)';
      const sourceAccNo = cleanAccountNo(pay.senderAccountNo || '0230128490');

      const recipientBank = r.payeeBank || 'ธนาคารกสิกรไทย (KBANK)';
      const recipientAccNo = cleanAccountNo(r.payeeBankNo || '0429384910');

      // Populate employees table
      if (r.empName) {
        employeeRowsSet.set(r.empName, [r.empName, r.pName || 'ทั่วไป', displayStatus, cleanNum(totalRequested)]);
      }

      // Collect receipts from r.receipts and clrs
      const receiptsSet = new Map<string, any>();
      if (r.receipts && r.receipts.length > 0) {
        r.receipts.forEach((rc: any) => {
          receiptsSet.set(rc.id, rc);
        });
      }
      if (r.clrs && r.clrs.length > 0) {
        r.clrs.forEach((clr: any) => {
          if (clr.receipts && clr.receipts.length > 0) {
            clr.receipts.forEach((rc: any) => {
              receiptsSet.set(rc.id || clr.id, { ...rc, id: rc.id || clr.id });
            });
          }
        });
      }

      if (receiptsSet.size > 0) {
        receiptsSet.forEach((rc) => {
          const items = rc.items || [];
          if (items.length > 0) {
            items.forEach((item: any) => {
              const amtNet = item.price * item.qty;
              const vatAmt = Math.round((amtNet * (item.vat || 0)) / 100);
              const totalAmt = amtNet + vatAmt;

              const fullRow = [
                displayStatus, r.id, r.reqDate, r.dueDate, r.empName, r.pName,
                sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo,
                rc.id || 'CLR-PENDING', r.id, rc.date || r.reqDate, rc.vendor || '–',
                rc.taxId || '–', rc.receiptNo || '–', rc.invoiceNo || '–',
                item.desc || '–', cleanNum(amtNet), cleanNum(vatAmt), '0', '0',
                cleanNum(totalAmt), cleanNum(totalRequested), cleanNum(totalCleared),
                cleanNum(outstandingBalance)
              ].map(cleanText);

              advancesRows.push(fullRow);
              if (rc.id && rc.id !== 'CLR-PENDING') {
                clearanceRows.push(fullRow);
              }
            });
          } else {
            const fullRow = [
              displayStatus, r.id, r.reqDate, r.dueDate, r.empName, r.pName,
              sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo,
              rc.id || 'CLR-PENDING', r.id, rc.date || r.reqDate, rc.vendor || '–',
              rc.taxId || '–', rc.receiptNo || '–', rc.invoiceNo || '–',
              r.desc || '–', cleanNum(rc.subtotal || rc.netTotal || 0), cleanNum(rc.vatAmount || 0), '0', '0',
              cleanNum(rc.netTotal || rc.subtotal || 0), cleanNum(totalRequested), cleanNum(totalCleared),
              cleanNum(outstandingBalance)
            ].map(cleanText);

            advancesRows.push(fullRow);
            if (rc.id && rc.id !== 'CLR-PENDING') {
              clearanceRows.push(fullRow);
            }
          }
        });
      } else {
        const fullRow = [
          displayStatus, r.id, r.reqDate, r.dueDate, r.empName, r.pName,
          sourceBank, sourceAccName, sourceAccNo, recipientBank, recipientAccNo,
          'CLR-PENDING', r.id, r.reqDate, '–', '–', '–', '–',
          r.desc || '–', cleanNum(totalRequested), '0', '0', '0',
          cleanNum(totalRequested), cleanNum(totalRequested), '0',
          cleanNum(totalRequested)
        ].map(cleanText);

        advancesRows.push(fullRow);
      }
    });

    const employeeRows: any[][] = [['Employee Name', 'Default Project', 'Default Status', 'Total Handled Amount']];
    employeeRowsSet.forEach((v) => employeeRows.push(v));

    // RegEx to pull spreadsheet ID
    const urlPattern = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

    for (const config of sheetsConfigs) {
      const match = config.url.match(urlPattern);
      if (!match) {
        console.warn(`⚠️ Skipped sync for sheet "\${config.name}" - Invalid or placeholder Google Sheets URL: \${config.url}`);
        syncDetails.push({ name: config.name, status: 'skipped', message: 'ที่อยู่ Google Sheets ไม่เป็นทางการ (เป็นตัวอย่างทดลอง)' });
        continue;
      }

      const id = match[1];
      let rowsToPush: any[][] = [];
      
      // Map configurations to computed data
      if (config.name.toLowerCase().includes('advance')) {
        rowsToPush = advancesRows;
      } else if (config.name.toLowerCase().includes('clear')) {
        rowsToPush = clearanceRows;
      } else if (config.name.toLowerCase().includes('employee') || config.name.toLowerCase().includes('staff') || config.name.toLowerCase().includes('member')) {
        rowsToPush = employeeRows;
      } else {
        rowsToPush = advancesRows; // Fallback
      }

      try {
        await pushGoogleSheetRows(id, config.name, rowsToPush);
        syncDetails.push({ name: config.name, status: 'synced', message: `ซิงก์ข้อมูลไปเรียบร้อยแล้ว (\${rowsToPush.length - 1} รายการ)` });
      } catch (err: any) {
        console.error(`❌ Sync to sheet "\${config.name}" failed:`, err);
        syncDetails.push({ name: config.name, status: 'error', message: err.message || 'เครือข่ายประทับตราผิดพลาด' });
      }
    }

    return res.json({ success: true, details: syncDetails });
  } catch (error: any) {
    console.error('❌ Synchronizer failed:', error);
    return res.status(500).json({ error: error.message || 'Sheets Synchronizer failure' });
  }
});

// -----------------------------------------------------------------------------
// LINE MESSAGING API INTEGRATION
// -----------------------------------------------------------------------------

/**
 * Sends a push message via LINE Messaging API
 */
async function pushLineMessage(to: string, text: string) {
  const config = await readStore<any>('line-messaging-config', null);
  if (!config || !config.channelAccessToken) {
    console.warn('⚠️ LINE Messaging is not configured. Message skipped.');
    return;
  }

  // 1. Try JSON Flex
  try {
     const json = JSON.parse(text);
     if (json && typeof json === 'object') {
       if (json.type === 'flex') {
         return pushFlexLineMessage(to, json.altText || 'Flex Message', json.contents || json);
       } else if (json.type === 'carousel' || json.type === 'bubble') {
         return pushFlexLineMessage(to, 'Flex Message', json);
       }
     }
  } catch (e) {
    // Not JSON, continue
  }

  if (text.includes('{WEEKLY_REPORT}')) {
    const flex = await generateWeeklyReportFlex();
    return pushFlexLineMessage(to, 'รายงานประจำสัปดาห์', flex);
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.channelAccessToken}`
      },
      body: JSON.stringify({
        to: to,
        messages: [{ type: 'text', text: text }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('LINE API response status:', response.status, err);
    } else {
      const successData = await response.json();
      console.log(`💚 LINE Message sent to ${to}. Response:`, JSON.stringify(successData));
      return { success: true, data: successData };
    }
  } catch (error: any) {
    console.warn('Failed to send LINE message:', error);
    return { success: false, error: error.message };
  }
}

async function pushFlexLineMessage(to: string, altText: string, flexContent: any) {
  const config = await readStore<any>('line-messaging-config', null);
  if (!config || !config.channelAccessToken) {
    console.warn('⚠️ LINE Messaging is not configured. Message skipped.');
    return;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.channelAccessToken}`
      },
      body: JSON.stringify({
        to: to,
        messages: [{ type: 'flex', altText: altText, contents: flexContent }]
      })
    });
    
    if (!response.ok) {
        const err = await response.text();
        console.warn('LINE API response status:', response.status, err);
    } else {
        const successData = await response.json();
        console.log(`💚 LINE Flex Message sent to ${to}. Response:`, JSON.stringify(successData));
        return { success: true, data: successData };
    }
  } catch (error: any) {
    console.warn('Failed to send LINE flex message:', error);
    return { success: false, error: error.message };
  }
}

async function generateWeeklyReportFlex() {
  const state = await readState();
  const advances = state.advances || [];
  
  const total = advances.reduce((sum, a) => sum + (Number(a.lineTotal) || 0), 0);
  const cleared = advances.filter(a => a.status === 'CLOSED').reduce((sum, a) => sum + (Number(a.lineTotal) || 0), 0);
  const outstanding = total - cleared;
  
  // Breakdown by person (assuming advances have `requester` or similar field)
  const breakdown: Record<string, number> = {};
  advances.filter(a => a.status !== 'CLOSED').forEach(a => {
    const person = a.requester || 'ไม่ระบุ';
    breakdown[person] = (breakdown[person] || 0) + (Number(a.lineTotal) || 0);
  });

  return {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "รายงานสรุปประจำสัปดาห์", "weight": "bold", "size": "lg", "color": "#ffffff" }
      ],
      "backgroundColor": "#06C755"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "ยอดรวมสะสม", "size": "sm", "color": "#555555" },
            { "type": "text", "text": `฿${total.toLocaleString()}`, "size": "sm", "align": "end", "weight": "bold" }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "เคลียร์แล้ว", "size": "sm", "color": "#555555" },
            { "type": "text", "text": `฿${cleared.toLocaleString()}`, "size": "sm", "align": "end", "weight": "bold", "color": "#06C755" }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "ยอดคงค้าง", "size": "sm", "color": "#555555" },
            { "type": "text", "text": `฿${outstanding.toLocaleString()}`, "size": "sm", "align": "end", "weight": "bold", "color": "#FF3B30" }
          ]
        },
        { "type": "separator", "margin": "lg" },
        { "type": "text", "text": "สรุปยอดค้างรายบุคคล", "weight": "bold", "margin": "lg", "size": "sm" },
        {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "margin": "md",
          "contents": Object.entries(breakdown).map(([name, amount]) => ({
            "type": "box",
            "layout": "horizontal",
            "contents": [
              { "type": "text", "text": name, "size": "xs", "color": "#666666", "flex": 2 },
              { "type": "text", "text": `฿${amount.toLocaleString()}`, "size": "xs", "align": "end", "weight": "bold" }
            ]
          }))
        }
      ]
    }
  };
}

async function approveAdvanceFromLine(advanceId: string, lineUserId: string) {
  const masterUsers = await readStore<any[]>('master-users', []);
  let user = masterUsers.find(u => u.lineId === lineUserId);
  
  const userName = user ? user.name : 'Unknown LINE User';
  const userRole = user ? user.role : 'Employee';
  
  if (userRole !== 'Administrator' && userRole !== 'Executive') {
    return { success: false, message: `⚠️ สิทธิ์ของคุณ (${userRole}) ไม่เพียงพอสำหรับการอนุมัติรายการ` };
  }

  const state = await readState();
  const advances = state.advances || [];
  const advance = advances.find((a: any) => a.id === advanceId);

  if (!advance) {
    return { success: false, message: `❌ ไม่พบรายการรหัส ${advanceId}` };
  }

  if (advance.status === 'WAITING_TRANSFER' || advance.status === 'รอโอน' || advance.status === 'CLOSED' || advance.status === 'ปิดยอด') {
    return { success: false, message: `ℹ️ รายการ ${advanceId} ได้รับการอนุมัติอยู่แล้ว` };
  }

  // Update advance fields
  const oldStatus = advance.status;
  advance.status = 'WAITING_TRANSFER';
  advance.appDate = new Date().toISOString().substring(0, 10);
  advance.appBy = `${userName} (${userRole} via LINE)`;
  advance.appAmount = advance.amount;

  // Task 11: Auto-create/update Document Tracking
  if (!advance.trackingRecord) {
    console.log(`📑 Initializing Document Tracking for ${advance.id} via LINE Approval`);
    advance.trackingRecord = {
      id: `TRK-${advance.id}`,
      status: 'Not Started',
      documents: [
        { id: 'DOC1', name: 'Original Receipt/Tax Invoice', attached: false, physical: false, receivedDate: null },
        { id: 'DOC2', name: 'Company Requisition Form', attached: true, physical: false, receivedDate: null }
      ],
      timeline: [{ date: new Date().toISOString(), action: 'Tracking Initialized (LINE)', status: 'waiting' }],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } else {
    advance.trackingRecord.timeline.push({ date: new Date().toISOString(), action: 'Approved (LINE)', status: 'success' });
  }

  // Write state
  await writeState(state);

  // Log audit
  const mockReq = { ip: 'LINE-BOT', headers: { 'user-agent': 'LineMessenger' } };
  await logAudit(mockReq as any, 'UPDATE_STATUS', advance.id, 'SUCCESS', { status: oldStatus }, { status: 'WAITING_TRANSFER' });

  // Send push notification if configured
  await handleAutomatedLineNotification(advance);

  return { success: true, message: `🟢 อนุมัติรายการ ${advanceId} เรียบร้อยแล้วโดย ${userName} (${userRole})` };
}

async function rejectAdvanceFromLine(advanceId: string, lineUserId: string, reason: string) {
  const masterUsers = await readStore<any[]>('master-users', []);
  let user = masterUsers.find(u => u.lineId === lineUserId);
  
  const userName = user ? user.name : 'Unknown LINE User';
  const userRole = user ? user.role : 'Employee';
  
  if (userRole !== 'Administrator' && userRole !== 'Executive') {
    return { success: false, message: `⚠️ สิทธิ์ของคุณ (${userRole}) ไม่เพียงพอสำหรับการปฏิเสธรายการ` };
  }

  const state = await readState();
  const advances = state.advances || [];
  const advance = advances.find((a: any) => a.id === advanceId);

  if (!advance) {
    return { success: false, message: `❌ ไม่พบรายการรหัส ${advanceId}` };
  }

  if (advance.status === 'REJECTED' || advance.status === 'ไม่อนุมัติ') {
    return { success: false, message: `ℹ️ รายการ ${advanceId} ถูกปฏิเสธอยู่แล้ว` };
  }

  const oldStatus = advance.status;
  advance.status = 'REJECTED';
  advance.appDate = new Date().toISOString().substring(0, 10);
  advance.appBy = `${userName} (${userRole} via LINE)`;
  advance.rejectReason = reason || 'ปฏิเสธผ่าน LINE';

  await writeState(state);

  // Log audit
  const mockReq = { ip: 'LINE-BOT', headers: { 'user-agent': 'LineMessenger' } };
  await logAudit(mockReq as any, 'UPDATE_STATUS', advance.id, 'SUCCESS', { status: oldStatus }, { status: 'REJECTED' });

  return { success: true, message: `🔴 ปฏิเสธรายการ ${advanceId} เรียบร้อยแล้วโดย ${userName} (${userRole})\nเหตุผล: ${advance.rejectReason}` };
}

// Webhook for LINE events (Messaging API requires a public webhook endpoint)
app.post('/api/line/webhook', express.json(), async (req, res) => {
  const events = req.body.events || [];
  const replies: string[] = [];
  
  for (const event of events) {
    console.log('📱 LINE Webhook Event Received:', event.type);
    
    // Check message and text
    if (event.type === 'message' && event.message.type === 'text') {
      const replyToken = event.replyToken;
      const userMessage = event.message.text;
      const lineUserId = event.source.userId || 'U23a4b5c6d';
      
      console.log(`📩 User said: ${userMessage} (User ID: ${lineUserId})`);
      
      // If user sends "ID", reply with their User ID or Group ID
      if (userMessage.toUpperCase() === 'ID') {
        const config = await readStore<any>('line-messaging-config', null);
        const contextId = event.source.groupId || lineUserId;
        const contextType = event.source.groupId ? 'Group' : 'User';
        const replyText = `Current ${contextType} ID for notifications:\n${contextId}\n\nCopy this ID to the app settings.`;
        
        replies.push(replyText);

        if (config && config.channelAccessToken && replyToken) {
          try {
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.channelAccessToken}`
              },
              body: JSON.stringify({
                replyToken: replyToken,
                messages: [{ type: 'text', text: replyText }]
              })
            });
          } catch (e) {
            console.error('Failed to reply to LINE message:', e);
          }
        }
      } else {
        // Regex commands
        const approveRegex = /^(อนุมัติ|approve)\s+(ADV-\d{4}-\d{3,5})/i;
        const rejectRegex = /^(ปฏิเสธ|reject)\s+(ADV-\d{4}-\d{3,5})(?:\s+(.+))?/i;

        if (approveRegex.test(userMessage.trim())) {
          const match = userMessage.trim().match(approveRegex);
          if (match) {
            const advanceId = match[2].toUpperCase();
            const resObj = await approveAdvanceFromLine(advanceId, lineUserId);
            replies.push(resObj.message);
            
            const config = await readStore<any>('line-messaging-config', null);
            if (config && config.channelAccessToken && replyToken) {
              try {
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.channelAccessToken}`
                  },
                  body: JSON.stringify({
                    replyToken: replyToken,
                    messages: [{ type: 'text', text: resObj.message }]
                  })
                });
              } catch (e) {
                console.error('Failed to reply to LINE message:', e);
              }
            }
          }
        } else if (rejectRegex.test(userMessage.trim())) {
          const match = userMessage.trim().match(rejectRegex);
          if (match) {
            const advanceId = match[2].toUpperCase();
            const reason = match[3] || 'ปฏิเสธผ่าน LINE';
            const resObj = await rejectAdvanceFromLine(advanceId, lineUserId, reason);
            replies.push(resObj.message);
            
            const config = await readStore<any>('line-messaging-config', null);
            if (config && config.channelAccessToken && replyToken) {
              try {
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.channelAccessToken}`
                  },
                  body: JSON.stringify({
                    replyToken: replyToken,
                    messages: [{ type: 'text', text: resObj.message }]
                  })
                });
              } catch (e) {
                console.error('Failed to reply to LINE message:', e);
              }
            }
          }
        } else {
          // Send generic instruction manual
          const helpText = `📝 LINE Advance Bot Commands:\n• ID - ดูรหัสไอดี\n• อนุมัติ [เลขใบเบิก] - อนุมัติใบเบิกเงิน\n• ปฏิเสธ [เลขใบเบิก] [เหตุผล] - ปฏิเสธใบเบิกเงิน\n\nตัวอย่าง:\nอนุมัติ ADV-2026-001\nปฏิเสธ ADV-2026-001 เอกสารไม่ชัดเจน`;
          replies.push(helpText);

          const config = await readStore<any>('line-messaging-config', null);
          if (config && config.channelAccessToken && replyToken) {
            try {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${config.channelAccessToken}`
                },
                body: JSON.stringify({
                  replyToken: replyToken,
                  messages: [{ type: 'text', text: helpText }]
                })
              });
            } catch (e) {
              console.error('Failed to reply to LINE message:', e);
            }
          }
        }
      }
    }
  }
  
  res.status(200).json({ status: 'OK', replies });
});

// Endpoint to fetch user profile from LINE
app.get('/api/line/user-profile/:userId', async (req, res) => {
  const { userId } = req.params;
  const config = await readStore<any>('line-messaging-config', null);

  if (!config || !config.channelAccessToken) {
    return res.status(400).json({ error: 'LINE configuration is missing.' });
  }

  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      }
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ LINE Profile API Error:', err);
      return res.status(response.status).json({ error: `Failed to fetch LINE profile: ${err}` });
    }

    const profile = await response.json();
    res.json(profile);
  } catch (error: any) {
    console.error('❌ Failed to fetch LINE profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION BUILD HANDLERS
// -----------------------------------------------------------------------------

async function verifyAndWarmupFirebase() {
  if (!isFirebaseConfigured()) return;
  
  console.log('🔄 Checking configuration eligibility for Firestore...');
  const resources = getFirebaseResources();
  if (!resources) {
    console.warn('⚠️ No initial Firebase resources could be structured.');
    return;
  }
  
  try {
    const testDoc = doc(resources.db, 'clearadvanceApp', 'boot_probe_dummy');
    await withFirebaseTimeout(getDoc(testDoc), 'Boot Probe', 10_000);
    console.log('💚 Firestore integration validated and ready!');
  } catch (error: any) {
    const msg = error?.message || String(error);
    
    if (FIREBASE_CONFIG.firestoreDatabaseId) {
      console.warn(`⚠️ Custom Firestore Database "${FIREBASE_CONFIG.firestoreDatabaseId}" is unavailable (encountered error/timeout). Switching immediately to default database "(default)" to avoid application disruption... Error details: ${msg}`);
      const brokenDb = firebaseResources?.db;
      FIREBASE_CONFIG.firestoreDatabaseId = '';
      firebaseResources = null; // reset cache
      if (brokenDb) {
        terminate(brokenDb).catch(() => {});
      }
      
      // Try again with default database
      const retryResources = getFirebaseResources();
      if (retryResources) {
        try {
          const testDocDefault = doc(retryResources.db, 'clearadvanceApp', 'boot_probe_dummy');
          await withFirebaseTimeout(getDoc(testDocDefault), 'Default Boot Probe', 10_000);
          console.log('💚 Fallback default database validated and ready!');
        } catch (innerErr: any) {
          console.warn('⚠️ Fallback default database also unavailable, using local cached engine:', innerErr.message);
        }
      }
    } else {
      console.warn('ℹ️ Firestore probe complete:', msg);
    }
  }
}

// Secure PIN verification endpoint (Task 4)
app.post('/api/auth/verify-pin', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN is required' });

  try {
    const masterUsers = await readStore<any[]>('master-users', []);
    const roles = await readStore<any[]>('roles', []);
    
    // Check master users
    for (const user of masterUsers) {
      let isValid = false;
      if (user.pinHash) {
        isValid = await bcrypt.compare(pin, user.pinHash);
      } else if (user.pin && user.pin === pin) {
        isValid = true;
      }
      
      if (isValid) {
        if (user.status === 'ปิดใช้งาน') return res.status(403).json({ error: 'User disabled' });
        return res.json({ 
          success: true, 
          user: { id: user.id, name: user.name, role: user.role, nickname: user.nickname } 
        });
      }
    }
    
    // Check role-based hardcoded passwords (Task 4 removal)
    // Production should move these to actual hashed role secrets or disable entirely
    // For now, we only allow master users with explicit PINs
    
    res.status(401).json({ error: 'Invalid PIN or password' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { userId, pin } = req.body;
  if (!userId || !pin) return res.status(400).json({ error: 'Missing credentials' });

  const masterUsers = await readStore<any[]>('master-users', []);
  const searchId = userId.trim();
  const user = masterUsers.find(u => 
    u.id?.toLowerCase() === searchId.toLowerCase() || 
    u.nickname?.toLowerCase() === searchId.toLowerCase()
  );

  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.status === 'ปิดใช้งาน') return res.status(401).json({ error: 'User disabled' });

  let isValid = false;
  if (user.pinHash) {
    isValid = await bcrypt.compare(pin, user.pinHash);
  } else if (user.pin === pin) {
    isValid = true;
  }

  if (!isValid) return res.status(401).json({ error: 'Invalid PIN' });

  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('auth_token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'none', 
    maxAge: 24 * 60 * 60 * 1000 
  });
  
  res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
});

app.get('/api/auth/me', requireAuth, async (req: any, res) => {
  const masterUsers = await readStore<any[]>('master-users', []);
  const user = masterUsers.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.post('/api/auth/line/link', async (req, res) => {
  const { userId, pin, lineId } = req.body;
  if (!userId || !pin || !lineId) return res.status(400).json({ error: 'Missing information' });

  try {
    const masterUsers = await readStore<any[]>('master-users', []);
    const userIndex = masterUsers.findIndex(u => u.id === userId || u.nickname === userId);
    
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    
    const user = masterUsers[userIndex];
    let isValid = false;
    if (user.pinHash) {
      isValid = await bcrypt.compare(pin, user.pinHash);
    } else if (user.pin === pin) {
      isValid = true;
    }
    
    if (!isValid) return res.status(401).json({ error: 'Invalid PIN' });
    
    // Remove LINE ID from any other user that might have it linked
    masterUsers.forEach(u => {
      if (u.lineId === lineId) {
        u.lineId = undefined;
      }
    });

    // Link the LINE ID
    user.lineId = lineId;
    masterUsers[userIndex] = user;
    await writeStore('master-users', masterUsers);
    
    // Set cookie and login
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 
    });
    
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// LINE Auth Endpoints
app.get('/api/auth/line/url', async (req, res) => {
  const storeConfig = await readStore<any>('line-messaging-config', null);
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID || storeConfig?.channelId;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET || storeConfig?.channelSecret;

  if (!channelId || !channelSecret) {
    return res.status(400).json({ error: 'LINE Login not configured' });
  }

  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https'; 
  const redirectUri = `${protocol}://${host}/api/auth/line/callback`;
  
  const authorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz&scope=openid%20profile`;
  res.json({ url: authorizeUrl });
});

app.get('/api/auth/line', async (req, res) => {
  const storeConfig = await readStore<any>('line-messaging-config', null);
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID || storeConfig?.channelId;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET || storeConfig?.channelSecret;

  if (!channelId || !channelSecret) {
      return res.status(400).send('LINE Login not configured. Please set LINE_LOGIN_CHANNEL_ID and LINE_LOGIN_CHANNEL_SECRET environment variables or configure via Settings.');
  }

  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https'; 
  const redirectUri = `${protocol}://${host}/api/auth/line/callback`;
  
  const authorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=xyz&scope=openid%20profile`;
  res.redirect(authorizeUrl);
});

app.get('/api/auth/line/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  
  if (error) {
    return res.status(400).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #334155;">
        <h2 style="color: #ef4444;">LINE Login Error</h2>
        <p>${error_description || error}</p>
        <p style="margin-top: 30px;"><a href="/" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Back to Login</a></p>
      </div>
    `);
  }

  const storeConfig = await readStore<any>('line-messaging-config', null);
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID || storeConfig?.channelId;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET || storeConfig?.channelSecret;

  if (!channelId || !channelSecret) return res.status(400).send('LINE not configured');

  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https'; 
  const redirectUri = `${protocol}://${host}/api/auth/line/callback`;
  
  try {
      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code as string,
              redirect_uri: redirectUri,
              client_id: channelId,
              client_secret: channelSecret
          })
      });
      
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        console.error('LINE Token Error:', tokenData);
        if (tokenData.error === 'invalid_grant' && tokenData.error_description === 'invalid authorization code') {
            return res.send(`
                <script>
                    if (window.opener) {
                        // Probably a double request or refresh, try to close or notify
                        window.close();
                    } else {
                        window.location.href = '/';
                    }
                </script>
                <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #334155;">
                  <h2 style="color: #f59e0b;">Authentication Stale</h2>
                  <p>This login attempt has already been processed or expired.</p>
                  <p><a href="/" style="color: #4f46e5; font-weight: bold;">Try logging in again</a></p>
                </div>
            `);
        }
        if (tokenData.error === 'invalid_client') {
            return res.status(401).send('LINE Login Configuration Error: Invalid Channel Secret or ID. Please check your Settings.');
        }
        throw new Error(tokenData.error_description || 'Failed to get LINE access token');
      }

      const profileResponse = await fetch('https://api.line.me/v2/profile', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      const profile = await profileResponse.json();
      
      if (!profile.userId) throw new Error('Failed to get LINE profile');

      const masterUsers = await readStore<any[]>('master-users', []);
      console.log('LINE Auth Callback Profile:', profile.userId);
      let user = masterUsers.find(u => u.lineId === profile.userId);
      
      if (!user) {
          console.log('Creating new user for LINE ID:', profile.userId);
          const newUserId = await generateEmployeeCode();
          console.log('Generated new User ID:', newUserId);
          user = {
              id: newUserId,
              name: profile.displayName || 'LINE User',
              nickname: '',
              position: 'พนักงาน (LINE)',
              role: 'Employee / Requester',
              bank: 'KBank',
              bankNo: '',
              bankAccountName: '',
              lineId: profile.userId,
              linePictureUrl: profile.pictureUrl || '',
              status: 'ใช้งาน',
              pin: '',
              hasSignature: false
          };
          masterUsers.push(user);
          await writeStore('master-users', masterUsers);
          console.log('New user created and saved:', user);
      } else {
          console.log('Existing user found:', user);
      }
      
      if (user.status === 'ปิดใช้งาน') return res.status(403).send('Account disabled');

      const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('auth_token', token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 
      });
      
      // Handle success based on whether it was a popup or redirect
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                // Was a popup
                window.opener.postMessage({ type: 'LINE_AUTH_SUCCESS', token: '${token}', user: ${JSON.stringify({ id: user.id, name: user.name, role: user.role })} }, '*');
                window.close();
              } else {
                // Was a direct redirect
                window.location.href = '/';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #334155;">
              <h2 style="color: #06C755;">Login Successful</h2>
              <p>Redirecting you back to the application...</p>
            </div>
          </body>
        </html>
      `);
  } catch (err: any) {
    console.error('LINE Auth Callback Failed:', err);
    res.status(500).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #334155;">
        <h2 style="color: #ef4444;">LINE Authentication Failed</h2>
        <p>${err.message}</p>
        <p style="margin-top: 20px;"><a href="/" style="color: #4f46e5;">Back to Login</a></p>
      </div>
    `);
  }
});

async function initializeApp() {
  await verifyAndWarmupFirebase();

  // One-time pristine production cleanup trigger
  const CLEAN_FLAG_FILE = path.join(DATA_DIR, '.clean_production_v1');
  if (!fs.existsSync(CLEAN_FLAG_FILE)) {
    console.log('🧹 One-time pristine production cleanup triggered...');
    try {
      // 1. Clear state
      await writeState({
        advances: [],
        settings: {
          auditLog: true,
          emailNotif: true,
          lineNotif: true,
          autoOCR: true,
          overdueAlert: true
        },
        running_numbers: {}
      });

      // 2. Clear stores
      const emptyStores = [
        'master-projects',
        'master-categories',
        'audit-logs',
        'files',
        'vault-docs',
        'ocr-scans',
        'clearance-actions',
        'review-transactions'
      ];
      for (const storeKey of emptyStores) {
        await writeStore(storeKey, []);
      }

      // 3. Clear local upload directory
      if (fs.existsSync(UPLOAD_DIR)) {
        const uploadFiles = fs.readdirSync(UPLOAD_DIR);
        for (const file of uploadFiles) {
          try {
            fs.unlinkSync(path.join(UPLOAD_DIR, file));
          } catch (e) {}
        }
      }

      // 4. Initialize master-users with only ADMIN-001
      const initialUsers = [{
        id: 'ADMIN-001',
        name: 'Initial Administrator',
        nickname: 'Admin',
        role: 'Administrator',
        status: 'ใช้งาน',
        pin: '1234', 
        position: 'System Setup'
      }];
      await writeStore('master-users', initialUsers);

      // Create clean marker
      fs.writeFileSync(CLEAN_FLAG_FILE, 'CLEANED_ON_' + new Date().toISOString());
      console.log('💚 Pristine production database initialized successfully!');
    } catch (err: any) {
      console.error('❌ One-time production cleanup failed:', err.message);
    }
  }

  // Essential bootstrap for first-time production setup
  try {
    let masterUsers = await readStore<any[]>('master-users', []);
    if (!Array.isArray(masterUsers)) masterUsers = [];

    // Ensure ADMIN-001 is always bootstrapped and active for administration
    const existingAdmin = masterUsers.find(u => u.id === 'ADMIN-001');
    if (!existingAdmin) {
      masterUsers.push({
        id: 'ADMIN-001',
        name: 'Initial Administrator',
        nickname: 'Admin',
        role: 'Administrator',
        status: 'ใช้งาน',
        pin: '1234', 
        position: 'System Setup'
      });
      await writeStore('master-users', masterUsers);
      console.log('⚠️ PRODUCTION BOOTSTRAP: Created initial Administrator account (ID: ADMIN-001, PIN: 1234)');
    } else {
      // Keep it active and reset PIN to 1234 if requested to ensure login is always functional
      let updated = false;
      if (existingAdmin.status !== 'ใช้งาน') {
        existingAdmin.status = 'ใช้งาน';
        updated = true;
      }
      if (existingAdmin.pin !== '1234' && !existingAdmin.pinHash) {
        existingAdmin.pin = '1234';
        updated = true;
      }
      if (updated) {
        await writeStore('master-users', masterUsers);
        console.log('⚠️ PRODUCTION BOOTSTRAP: Reset ADMIN-001 account status to active and PIN 1234');
      }
    }
  } catch (err) {
    console.error('Failed to initialize bootstrap user:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: HMR_PORT }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 AdvPosh ERP Express + Vite server booted successfully on http://${HOST}:${PORT}`);
  });
}

initializeApp().catch(err => {
  console.error('❌ Failed to boots up server express:', err);
});
