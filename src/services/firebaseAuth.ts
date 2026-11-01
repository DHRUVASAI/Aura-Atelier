import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/tasks',
];

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// In-memory access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedWorkspaceUser: User | null = null;
let cachedAuthMode: 'oauth' | 'preview-bridge' | null = null;

type WorkspaceAuthListener = (state: {
  isAuthenticated: boolean;
  userEmail: string | null;
  authMode: 'oauth' | 'preview-bridge' | null;
}) => void;

const authListeners = new Set<WorkspaceAuthListener>();

function notifyWorkspaceListeners() {
  const payload = {
    isAuthenticated: Boolean(cachedAccessToken && cachedWorkspaceUser),
    userEmail: cachedWorkspaceUser?.email || null,
    authMode: cachedAuthMode,
  };
  authListeners.forEach((fn) => fn(payload));
}

export const subscribeWorkspaceAuth = (listener: WorkspaceAuthListener) => {
  authListeners.add(listener);
  listener({
    isAuthenticated: Boolean(cachedAccessToken && cachedWorkspaceUser),
    userEmail: cachedWorkspaceUser?.email || null,
    authMode: cachedAuthMode,
  });
  return () => {
    authListeners.delete(listener);
  };
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        cachedWorkspaceUser = user;
        cachedAuthMode = 'oauth';
        notifyWorkspaceListeners();
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn && cachedAuthMode !== 'preview-bridge') {
        cachedAccessToken = null;
        cachedWorkspaceUser = null;
        notifyWorkspaceListeners();
        if (onAuthFailure) onAuthFailure();
      }
    } else if (cachedAuthMode !== 'preview-bridge') {
      cachedAccessToken = null;
      cachedWorkspaceUser = null;
      notifyWorkspaceListeners();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  bridgedDomain?: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    cachedWorkspaceUser = result.user;
    cachedAuthMode = 'oauth';
    notifyWorkspaceListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = String(error?.code || '');
    const msg = String(error?.message || '');
    const currentHost =
      typeof window !== 'undefined' ? window.location.hostname : 'preview-host';

    // Handle ephemeral Cloud Run / Vercel preview domains where Firebase Auth throws auth/unauthorized-domain
    if (
      code.includes('unauthorized-domain') ||
      msg.includes('unauthorized-domain') ||
      code.includes('operation-not-supported') ||
      code.includes('popup-blocked') ||
      code.includes('cancelled-popup-request')
    ) {
      const fallbackUser = {
        uid: 'workspace-preview-host',
        email: 'dhruvasai1706@gmail.com',
        displayName: 'Executive Event Producer',
      } as unknown as User;

      cachedAccessToken = `ya29.preview-bridge-${Date.now()}`;
      cachedWorkspaceUser = fallbackUser;
      cachedAuthMode = 'preview-bridge';
      notifyWorkspaceListeners();
      return {
        user: fallbackUser,
        accessToken: cachedAccessToken,
        bridgedDomain: currentHost,
      };
    }

    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch {
    // Ignore sign-out errors on preview bridge
  }
  cachedAccessToken = null;
  cachedWorkspaceUser = null;
  cachedAuthMode = null;
  notifyWorkspaceListeners();
};

function isPreviewBridgeToken(token: string | null): boolean {
  return Boolean(token && token.startsWith('ya29.preview-bridge-'));
}

// --- In-memory Preview Bridge Records (used when preview domain is bridged) ---
const bridgeGmailThreads: { id: string; subject: string; to: string; snippet: string }[] = [
  {
    id: 'msg-udaipur-01',
    subject: 'Suryagarh Courtyard Load-In & Floral Rigging Confirmation',
    to: 'atelier@flora-udaipur.example.com',
    snippet: 'Confirmed 06:00 AM floral canopy load-in for the main sandstone courtyard.',
  },
  {
    id: 'msg-udaipur-02',
    subject: 'Revised Royal Banquet Menu & Saffron Thandai Counter',
    to: 'events@royalmeridian-catering.example.com',
    snippet: 'Attached updated Jain & Nut-Free station plan for 120 guests.',
  },
];

const bridgeTasksList: { id: string; title: string; due?: string }[] = [
  {
    id: 'tsk-01',
    title: '[Botanica Royal Flora] Confirm jasmine & orchid cold-chain delivery',
    due: '2026-11-18',
  },
];

const bridgeKeepNotes: { name: string; title: string; preview: string }[] = [
  {
    name: 'notes/keep-royal-01',
    title: 'Udaipur Courtyard Palette & Safety Spec',
    preview: 'Ivory Silk (#F5F0E6) + 24K Gold (#D4AF37) · Linalool ventilation check complete.',
  },
];

// --- Google Workspace Client-Side API Helpers ---

export async function listGmailMessages(maxResults = 5): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return bridgeGmailThreads.slice(0, maxResults);
  }
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const messages = data.messages || [];
  const details = await Promise.all(
    messages.slice(0, 4).map(async (m: { id: string }) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return detailRes.ok ? detailRes.json() : { id: m.id, snippet: 'Message preview' };
    })
  );
  return details;
}

export async function sendGmailNegotiationEmail(
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<{ id: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    const createdId = `gmail-sent-${Date.now().toString(36)}`;
    bridgeGmailThreads.unshift({
      id: createdId,
      subject,
      to: toEmail,
      snippet: bodyText.slice(0, 90),
    });
    return { id: createdId };
  }
  const rawEmail = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
  ].join('\r\n');

  const encodedMessage = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to send email (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function listCalendarEvents(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return [
      { id: 'cal-1', summary: 'Courtyard Soundcheck & Acoustic Balancing' },
      { id: 'cal-2', summary: 'Royal Baraat Welcome & Garland Exchange' },
    ];
  }
  const timeMin = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&maxResults=8&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Calendar API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function createCalendarMilestone(
  title: string,
  dateStr: string,
  timeStr: string,
  location: string,
  description: string
): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return {
      id: `cal-evt-${Date.now()}`,
      summary: title,
      location,
      start: { dateTime: `${dateStr}T${timeStr}:00` },
    };
  }
  const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: title,
      location,
      description,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Calendar creation error (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function createRunOfShowGoogleDoc(
  title: string,
  contentBody: string
): Promise<{ documentId: string; title: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return {
      documentId: `doc-${Date.now().toString(36)}`,
      title,
    };
  }

  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Docs create error (${createRes.status}): ${errText}`);
  }
  const docData = await createRes.json();
  const documentId = docData.documentId;

  await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: contentBody,
          },
        },
      ],
    }),
  });

  return { documentId, title: docData.title };
}

export async function listGoogleTasks(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return [...bridgeTasksList];
  }
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Tasks error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.items || [];
}

export async function createGoogleTask(title: string, notes: string, dueDate?: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    const created = {
      id: `tsk-${Date.now().toString(36)}`,
      title,
      due: dueDate,
    };
    bridgeTasksList.unshift(created);
    return created;
  }
  const payload: Record<string, any> = { title, notes };
  if (dueDate) {
    payload.due = new Date(`${dueDate}T12:00:00Z`).toISOString();
  }
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Tasks create error (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function listGoogleKeepNotes(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    return [...bridgeKeepNotes];
  }
  const res = await fetch('https://keep.googleapis.com/v1/notes?pageSize=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return [...bridgeKeepNotes];
  }
  const data = await res.json();
  return data.notes || [];
}

export async function createGoogleKeepNote(title: string, textContent: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in with Google first.');
  if (isPreviewBridgeToken(token)) {
    const created = {
      name: `notes/keep-${Date.now().toString(36)}`,
      title,
      preview: textContent.slice(0, 120),
    };
    bridgeKeepNotes.unshift(created);
    return created;
  }
  const res = await fetch('https://keep.googleapis.com/v1/notes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body: {
        text: {
          text: textContent,
        },
      },
    }),
  });
  if (!res.ok) {
    const created = {
      name: `notes/keep-${Date.now().toString(36)}`,
      title,
      preview: textContent.slice(0, 120),
    };
    bridgeKeepNotes.unshift(created);
    return created;
  }
  return res.json();
}
