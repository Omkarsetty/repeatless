import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/db';
import { incrementalSyncGmail, sendEmailReply, sendNewEmail } from '../services/gmail';
import { generateNewEmailDraft, generateReplyDraft } from '../services/ai';

const router = Router();

/**
 * GET /api/emails/stats
 * Returns category and sync statistics for the dashboard
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. Fetch account info
    const { data: account } = await supabase
      .from('accounts')
      .select('email, last_sync_time')
      .eq('id', userId)
      .single();

    // 2. Count by categories
    const { data: emails } = await supabase
      .from('emails')
      .select('category')
      .eq('user_id', userId);

    const counts: Record<string, number> = {
      'Newsletters': 0,
      'Job / Recruitment': 0,
      'Finance': 0,
      'Notifications': 0,
      'Personal': 0,
      'Work / Professional': 0
    };

    let total = 0;
    if (emails) {
      emails.forEach(e => {
        if (e.category && counts[e.category] !== undefined) {
          counts[e.category]++;
        }
        total++;
      });
    }

    res.json({
      email: account?.email || 'N/A',
      lastSyncTime: account?.last_sync_time || null,
      totalCount: total,
      categories: counts
    });
  } catch (err) {
    console.error('Failed to load email stats:', err);
    res.status(500).json({ error: 'Failed to retrieve email dashboard stats.' });
  }
});

/**
 * GET /api/threads
 * Returns a list of threads for the inbox, optionally filtered by category
 */
router.get('/threads', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { category } = req.query;

  try {
    // We want to fetch threads that contain emails in the specified category
    let queryBuilder = supabase
      .from('threads')
      .select(`
        id,
        summary,
        updated_at,
        emails!inner (
          id,
          subject,
          from_address,
          snippet,
          date,
          category
        )
      `)
      .eq('user_id', userId);

    if (category && typeof category === 'string') {
      queryBuilder = queryBuilder.eq('emails.category', category);
    }

    const { data: threads, error } = await queryBuilder.order('updated_at', { ascending: false });

    if (error) throw error;

    // Format threads data for frontend
    const formatted = (threads || []).map((t: any) => {
      // Sort emails chronologically
      const emails = (t.emails || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const lastEmail = emails[emails.length - 1];

      return {
        id: t.id,
        summary: t.summary,
        updatedAt: t.updated_at,
        subject: emails[0]?.subject || 'No Subject',
        sender: emails[0]?.from_address || 'Unknown Sender',
        lastSender: lastMsgSender(lastEmail?.from_address),
        snippet: lastEmail?.snippet || '',
        date: lastEmail?.date || t.updated_at,
        messageCount: emails.length,
        categories: Array.from(new Set(emails.map((e: any) => e.category).filter(Boolean)))
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Failed to load threads:', err);
    res.status(500).json({ error: 'Failed to retrieve threads list.' });
  }
});

function lastMsgSender(from: string | undefined): string {
  if (!from) return 'System';
  // return just the name if available e.g. "John Doe <john@gmail.com>" -> "John Doe"
  const bracketIndex = from.indexOf('<');
  if (bracketIndex > 0) {
    return from.slice(0, bracketIndex).trim();
  }
  return from;
}

/**
 * GET /api/threads/:id
 * Fetches all messages and summary for a single thread
 */
router.get('/threads/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id: threadId } = req.params;

  try {
    const { data: thread } = await supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const { data: emails } = await supabase
      .from('emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('date', { ascending: true });

    res.json({
      id: thread.id,
      summary: thread.summary,
      updatedAt: thread.updated_at,
      messages: emails || []
    });
  } catch (err) {
    console.error(`Failed to fetch thread detail for ${threadId}:`, err);
    res.status(500).json({ error: 'Failed to load thread messages.' });
  }
});

/**
 * POST /api/emails/sync
 * Manually trigger incremental sync
 */
router.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (userId === 'mock-user-123') {
      // Mock sync takes 1 sec and does nothing (already seeded)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.json({ success: true, message: 'Mock sync completed.' });
    }

    await incrementalSyncGmail(userId);
    res.json({ success: true, message: 'Incremental sync completed successfully.' });
  } catch (err) {
    console.error('Incremental sync failed:', err);
    res.status(500).json({ error: 'Failed to sync latest email updates.' });
  }
});

/**
 * POST /api/emails/compose-draft
 * Generate subject & body from a prompt
 */
router.post('/compose-draft', async (req: AuthenticatedRequest, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

  try {
    const draft = await generateNewEmailDraft(prompt);
    res.json(draft);
  } catch (err) {
    console.error('Draft generation failed:', err);
    res.status(500).json({ error: 'Failed to generate email draft.' });
  }
});

/**
 * POST /api/emails/reply-draft
 * Generate reply text from a prompt + thread context
 */
router.post('/reply-draft', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { prompt, threadId } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!prompt || !threadId) return res.status(400).json({ error: 'Prompt and threadId are required.' });

  try {
    // Fetch thread messages chronologically
    const { data: emails } = await supabase
      .from('emails')
      .select('subject, from_address, body_text, date')
      .eq('thread_id', threadId)
      .order('date', { ascending: true });

    const sorted = (emails || []).map(e => ({
      subject: e.subject || '',
      from: e.from_address || '',
      bodyText: e.body_text || '',
      date: e.date ? new Date(e.date).toISOString() : ''
    }));

    const draft = await generateReplyDraft(prompt, sorted);
    res.json({ body: draft });
  } catch (err) {
    console.error('Reply draft generation failed:', err);
    res.status(500).json({ error: 'Failed to generate thread reply draft.' });
  }
});

/**
 * POST /api/emails/send
 * Sends a brand new email
 */
router.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { to, subject, body } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!to || !subject || !body) return res.status(400).json({ error: 'Recipient (to), subject, and body are required.' });

  try {
    if (userId === 'mock-user-123') {
      // Mock sending: create a new thread and email in database
      const mockThreadId = `thread-mock-sent-${Date.now()}`;
      const mockEmailId = `email-mock-sent-${Date.now()}`;

      await supabase.from('threads').insert({
        id: mockThreadId,
        user_id: userId,
        summary: `Sent email to ${to} regarding "${subject}".`
      });

      await supabase.from('emails').insert({
        id: mockEmailId,
        thread_id: mockThreadId,
        user_id: userId,
        subject,
        from_address: 'demo-user@repeatless.in',
        to_addresses: [to],
        date: new Date().toISOString(),
        body_text: body,
        snippet: body.slice(0, 100),
        category: 'Work / Professional',
        summary: `Sent email with subject: ${subject}`
      });

      return res.json({ success: true, message: 'Mock email sent successfully.', threadId: mockThreadId });
    }

    const data = await sendNewEmail(userId, to, subject, body);
    res.json({ success: true, message: 'Email sent successfully.', details: data });
  } catch (err) {
    console.error('Sending email failed:', err);
    res.status(500).json({ error: 'Failed to dispatch email.' });
  }
});

/**
 * POST /api/emails/send-reply
 * Sends a reply preserving thread headers
 */
router.post('/send-reply', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { threadId, body } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!threadId || !body) return res.status(400).json({ error: 'Thread ID and body are required.' });

  try {
    if (userId === 'mock-user-123') {
      // Mock reply sending: append message to existing mock thread
      const mockEmailId = `email-mock-sent-${Date.now()}`;

      // Grab existing emails to get subject
      const { data: firstEmail } = await supabase
        .from('emails')
        .select('subject')
        .eq('thread_id', threadId)
        .limit(1)
        .single();

      const subject = firstEmail ? `Re: ${firstEmail.subject}` : 'Re: Discussion';

      await supabase.from('emails').insert({
        id: mockEmailId,
        thread_id: threadId,
        user_id: userId,
        subject,
        from_address: 'demo-user@repeatless.in',
        to_addresses: ['external-party@example.com'],
        date: new Date().toISOString(),
        body_text: body,
        snippet: body.slice(0, 100),
        category: 'Work / Professional',
        summary: 'Sent a response in the discussion.'
      });

      // Update thread timestamp
      await supabase
        .from('threads')
        .update({ updated_at: new Date() })
        .eq('id', threadId);

      return res.json({ success: true, message: 'Mock reply sent successfully.' });
    }

    const data = await sendEmailReply(userId, threadId, body);
    res.json({ success: true, message: 'Thread reply sent successfully.', details: data });
  } catch (err) {
    console.error('Sending reply failed:', err);
    res.status(500).json({ error: 'Failed to dispatch thread reply.' });
  }
});

export default router;
