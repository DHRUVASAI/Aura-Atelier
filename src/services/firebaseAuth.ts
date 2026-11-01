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
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
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
  await auth.signOut();
  cachedAccessToken = null;
};

// --- Google Workspace Client-Side API Helpers ---

export async function listGmailMessages(maxResults = 5): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');

  // Step 1: Create blank doc
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

  // Step 2: Insert Run-of-Show text via batchUpdate
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
  if (!token) throw new Error('Not authenticated with Google Workspace.');
  const res = await fetch('https://keep.googleapis.com/v1/notes?pageSize=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Google Keep API (${res.status}): Note that Google Keep API requires an Enterprise Workspace domain-wide delegation account. Details: ${errText}`
    );
  }
  const data = await res.json();
  return data.notes || [];
}

export async function createGoogleKeepNote(title: string, textContent: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace.');
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
    const errText = await res.text();
    throw new Error(
      `Google Keep API (${res.status}): Enterprise Workspace domain account required for Keep REST mutations. Details: ${errText}`
    );
  }
  return res.json();
}
