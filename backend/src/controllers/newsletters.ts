import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/db';
import { deduplicateNewsletters } from '../services/ai';

const router = Router();

/**
 * GET /api/newsletters/digest
 * Retrieves news digests from newsletter emails within a specified days range, semantically deduplicating overlaps
 */
router.get('/digest', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Get days param, default to 7 days
  const daysParam = req.query.days ? parseInt(req.query.days as string, 10) : 7;
  const days = isNaN(daysParam) ? 7 : daysParam;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Fetch newsletter emails since the cutoff date
    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, subject, from_address, snippet, body_text, date')
      .eq('user_id', userId)
      .eq('category', 'Newsletters')
      .gte('date', cutoffDate.toISOString())
      .order('date', { ascending: false });

    if (error) throw error;

    if (!emails || emails.length === 0) {
      return res.json([]);
    }

    // Call semantic deduplication service
    const newsletterItems = emails.map(e => ({
      id: e.id,
      subject: e.subject || 'No Subject',
      from: e.from_address || 'Unknown Sender',
      snippet: e.snippet || '',
      body: e.body_text || '',
      date: e.date
    }));

    const deduplicatedStories = await deduplicateNewsletters(newsletterItems);
    res.json(deduplicatedStories);
  } catch (err) {
    console.error('Failed to generate news digest:', err);
    res.status(500).json({ error: 'Failed to compile and deduplicate newsletter articles.' });
  }
});

export default router;
