import { google } from 'googleapis';
import { config } from '../config/env';
import { supabase, query } from '../config/db';
import { categorizeEmail, summarizeEmail, summarizeThread, generateEmbedding } from './ai';
import pLimit from 'p-limit';

// Google OAuth 2.0 Client setup
export const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URI
);

// Scopes required for synchronization and sending replies
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Generate authorization URL for the user
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent'
  });
}

/**
 * Get Google credentials client for a specific user ID
 */
export async function getGmailClient(userId: string) {
  // Query token details from Supabase
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !account) {
    throw new Error(`Account not found for user ${userId}`);
  }

  const client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry ? new Date(account.token_expiry).getTime() : undefined
  });

  // Automatically refresh token if expired
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updateData: any = {
        access_token: tokens.access_token,
        updated_at: new Date()
      };
      if (tokens.expiry_date) {
        updateData.token_expiry = new Date(tokens.expiry_date);
      }
      await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', userId);
    }
  });

  return google.gmail({ version: 'v1', auth: client });
}

/**
 * Utility to run Gmail API requests with exponential backoff for rate limits (429)
 */
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isRateLimit = err.status === 429 || (err.response && err.response.status === 429);
    const isServerErr = err.status === 503 || (err.response && err.response.status === 503);
    
    if ((isRateLimit || isServerErr) && retries > 0) {
      console.warn(`[Gmail API Rate Limit / Quota] Hit 429/503. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

/**
 * Parse headers from Gmail message payload
 */
function parseHeaders(headers: any[]) {
  const result = {
    subject: '',
    from: '',
    to: [] as string[],
    cc: [] as string[],
    bcc: [] as string[],
    date: new Date(),
    messageId: ''
  };

  for (const h of headers) {
    const name = h.name?.toLowerCase() || '';
    const value = h.value || '';
    if (!name) continue;

    if (name === 'subject') result.subject = value;
    else if (name === 'from') result.from = value;
    else if (name === 'to') result.to = value.split(',').map((s: string) => s.trim());
    else if (name === 'cc') result.cc = value.split(',').map((s: string) => s.trim());
    else if (name === 'bcc') result.bcc = value.split(',').map((s: string) => s.trim());
    else if (name === 'date') result.date = new Date(value);
    else if (name === 'message-id') result.messageId = value;
  }

  return result;
}

/**
 * Strip HTML tags and normalize spaces
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Traverse Gmail MIME parts recursively to extract plain text
 */
function extractBodyText(payload: any): string {
  if (!payload) return '';

  if (payload.body && payload.body.data && payload.mimeType === 'text/plain') {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.body && payload.body.data && payload.mimeType === 'text/html') {
    return stripHtmlTags(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
  }

  if (payload.parts && payload.parts.length > 0) {
    let body = '';
    // Check plain text parts first
    const plainPart = findPartByMimeType(payload.parts, 'text/plain');
    if (plainPart && plainPart.body && plainPart.body.data) {
      body += Buffer.from(plainPart.body.data, 'base64').toString('utf-8');
    } else {
      // Fallback to HTML part
      const htmlPart = findPartByMimeType(payload.parts, 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        body += stripHtmlTags(Buffer.from(htmlPart.body.data, 'base64').toString('utf-8'));
      }
    }
    return body;
  }

  return '';
}

function findPartByMimeType(parts: any[], mimeType: string): any {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part;
    if (part.parts && part.parts.length > 0) {
      const found = findPartByMimeType(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Full Sync user inbox
 * Limit threads to prevent api limits / timeouts during evaluation
 */
export async function syncGmailInbox(userId: string, maxThreadsToSync = 30) {
  console.log(`Starting Gmail Sync for user ${userId}...`);
  const gmail = await getGmailClient(userId);

  // 1. Fetch thread list
  const listThreads = () => gmail.users.threads.list({
    userId: 'me',
    maxResults: maxThreadsToSync
  });

  const response = await executeWithRetry(listThreads);
  const threads = response.data.threads || [];
  console.log(`Found ${threads.length} threads to process.`);

  // Use limit for concurrency to be polite to APIs (Gemini + Gmail)
  const limit = pLimit(3); 
  const tasks = threads.map((t, index) => {
    return limit(async () => {
      try {
        if (!t.id) return;
        await syncThread(userId, gmail, t.id);
        console.log(`Sync complete for thread ${index + 1}/${threads.length}: ${t.id}`);
      } catch (err) {
        console.error(`Error syncing thread ${t.id}:`, err);
      }
    });
  });

  await Promise.all(tasks);

  // 2. Set last sync time and history ID
  const now = new Date();
  const profileResponse = await executeWithRetry(() => gmail.users.getProfile({ userId: 'me' }));
  const historyId = profileResponse.data.historyId || undefined;

  await supabase
    .from('accounts')
    .update({
      last_sync_time: now,
      last_history_id: historyId,
      updated_at: now
    })
    .eq('id', userId);

  console.log(`Gmail Sync completed for user ${userId}. Last History ID: ${historyId}`);
}

/**
 * Sync a single Thread ID and its messages
 */
export async function syncThread(userId: string, gmail: any, threadId: string) {
  // 1. Fetch full thread content from Gmail
  const getThread = () => gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  });

  const response = (await executeWithRetry(getThread)) as any;
  const threadData = response.data;
  const messages = threadData.messages || [];

  if (messages.length === 0) return;

  // 2. Ensure thread exists in db
  const { data: existingThread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .single();

  if (!existingThread) {
    await supabase.from('threads').insert({
      id: threadId,
      user_id: userId
    });
  }

  // 3. Process each message in the thread
  const syncMessagesList = [];
  for (const msg of messages) {
    if (!msg.id) continue;

    // Check if message is already synced
    const { data: existingMsg } = await supabase
      .from('emails')
      .select('id')
      .eq('id', msg.id)
      .single();

    if (existingMsg) {
      syncMessagesList.push(existingMsg);
      continue;
    }

    // Parse message headers & body
    const headersData = parseHeaders(msg.payload?.headers || []);
    const bodyText = extractBodyText(msg.payload);
    const snippet = msg.snippet || '';

    // Classify Email via NVIDIA NIM
    const category = await categorizeEmail(
      headersData.subject,
      headersData.from,
      snippet,
      bodyText
    );

    // Summarize Email via Gemini
    const summary = await summarizeEmail(
      headersData.subject,
      headersData.from,
      bodyText || snippet
    );

    // Insert message into DB
    const emailRecord = {
      id: msg.id,
      thread_id: threadId,
      user_id: userId,
      subject: headersData.subject,
      from_address: headersData.from,
      to_addresses: headersData.to,
      cc_addresses: headersData.cc,
      bcc_addresses: headersData.bcc,
      date: headersData.date,
      body_text: bodyText,
      body_html: msg.payload?.body?.data || '',
      snippet: snippet,
      label_ids: msg.labelIds || [],
      category,
      summary,
      processed_at: new Date()
    };

    await supabase.from('emails').insert(emailRecord);

    // Generate RAG embeddings
    const embeddedText = `From: ${headersData.from}\nSubject: ${headersData.subject}\nSnippet: ${snippet}\nBody: ${bodyText.slice(0, 1500)}`;
    const embedding = await generateEmbedding(embeddedText);

    // Save embedding in pgvector table using direct query helper (Supabase RPC can also be used)
    await query(
      `insert into email_embeddings (email_id, thread_id, user_id, content, embedding)
       values ($1, $2, $3, $4, $5::vector)`,
      [msg.id, threadId, userId, embeddedText, JSON.stringify(embedding)]
    );

    syncMessagesList.push(emailRecord);
  }

  // 4. Update thread summary using all messages in chronological order
  const sortedMessages = syncMessagesList
    .map((m: any) => ({
      subject: m.subject || '',
      from: m.from_address || '',
      bodyText: m.body_text || m.snippet || '',
      date: m.date ? new Date(m.date).toISOString() : ''
    }));

  const threadSummary = await summarizeThread(sortedMessages);
  await supabase
    .from('threads')
    .update({ summary: threadSummary, updated_at: new Date() })
    .eq('id', threadId);
}

/**
 * Incremental sync using date query
 */
export async function incrementalSyncGmail(userId: string) {
  const { data: account } = await supabase
    .from('accounts')
    .select('last_sync_time')
    .eq('id', userId)
    .single();

  const gmail = await getGmailClient(userId);
  let q = '';

  if (account && account.last_sync_time) {
    // Sync emails updated in the last 2 days to account for timezone drift
    const epochSecs = Math.floor(new Date(account.last_sync_time).getTime() / 1000) - (2 * 24 * 3600);
    q = `after:${epochSecs}`;
  }

  console.log(`Incremental sync: fetching threads with query: "${q}"`);
  
  const listThreads = () => gmail.users.threads.list({
    userId: 'me',
    q: q || undefined,
    maxResults: 20
  });

  const response = await executeWithRetry(listThreads);
  const threads = response.data.threads || [];
  console.log(`Found ${threads.length} new/updated threads to sync.`);

  const limit = pLimit(3);
  const tasks = threads.map((t, idx) => {
    return limit(async () => {
      if (!t.id) return;
      await syncThread(userId, gmail, t.id);
      console.log(`Incremental sync complete for thread ${idx + 1}/${threads.length}: ${t.id}`);
    });
  });

  await Promise.all(tasks);

  await supabase
    .from('accounts')
    .update({
      last_sync_time: new Date(),
      updated_at: new Date()
    })
    .eq('id', userId);
  
  console.log(`Incremental sync finished for user ${userId}.`);
}

/**
 * Send a reply to an email thread via Gmail API
 */
export async function sendEmailReply(
  userId: string,
  threadId: string,
  replyText: string
): Promise<any> {
  const gmail = await getGmailClient(userId);

  // 1. Get the last message in the thread to pull Message-ID, Subject, and Sender
  const getThread = () => gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  });

  const response = await executeWithRetry(getThread);
  const messages = response.data.messages || [];
  if (messages.length === 0) {
    throw new Error(`Cannot reply to empty thread ${threadId}`);
  }

  const lastMsg = messages[messages.length - 1];
  const headers = parseHeaders(lastMsg.payload?.headers || []);

  // Determine recipient (the original sender or whoever we received it from)
  // If we sent it, reply to the first message sender or to headers.from
  let replyTo = headers.from;
  // Strip out user name if any: "John Doe <john@gmail.com>" -> "john@gmail.com"
  const emailRegex = /<([^>]+)>/;
  const match = emailRegex.exec(replyTo);
  if (match) {
    replyTo = match[1];
  }

  // Get user details
  const { data: userAcc } = await supabase
    .from('accounts')
    .select('email')
    .eq('id', userId)
    .single();

  const userEmail = userAcc?.email || 'me';

  // Ensure subject prefix contains 'Re:'
  let subject = headers.subject;
  if (!subject.toLowerCase().startsWith('re:')) {
    subject = `Re: ${subject}`;
  }

  // Construct MIME email headers
  const mimeHeaders = [
    `To: ${replyTo}`,
    `From: ${userEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  // Preserve thread relations
  if (headers.messageId) {
    mimeHeaders.push(`In-Reply-To: ${headers.messageId}`);
    mimeHeaders.push(`References: ${headers.messageId}`);
  }

  const rawMime = [...mimeHeaders, '', replyText].join('\r\n');
  const encodedEmail = Buffer.from(rawMime).toString('base64url');

  const sendResponse = await executeWithRetry(() => gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
      threadId: threadId
    }
  }));

  // Resync this thread to update our db with the sent reply
  await syncThread(userId, gmail, threadId);

  return sendResponse.data;
}

/**
 * Send a brand new email via Gmail API
 */
export async function sendNewEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<any> {
  const gmail = await getGmailClient(userId);

  const { data: userAcc } = await supabase
    .from('accounts')
    .select('email')
    .eq('id', userId)
    .single();

  const userEmail = userAcc?.email || 'me';

  const mimeHeaders = [
    `To: ${to}`,
    `From: ${userEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  const rawMime = [...mimeHeaders, '', body].join('\r\n');
  const encodedEmail = Buffer.from(rawMime).toString('base64url');

  const sendResponse = await executeWithRetry(() => gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail
    }
  }));

  // Perform sync thread to pull the sent message and save in DB
  const threadId = sendResponse.data.threadId;
  if (threadId) {
    await syncThread(userId, gmail, threadId);
  }

  return sendResponse.data;
}
