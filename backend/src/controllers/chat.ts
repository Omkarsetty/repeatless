import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/db';
import { queryChatAgent } from '../services/rag';

const router = Router();

/**
 * GET /api/chat/sessions
 * List all chat sessions for the authenticated user
 */
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(sessions || []);
  } catch (err) {
    console.error('Failed to load chat sessions:', err);
    res.status(500).json({ error: 'Failed to retrieve conversational history sessions.' });
  }
});

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { title } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: title || 'New Conversation'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(session);
  } catch (err) {
    console.error('Failed to create chat session:', err);
    res.status(500).json({ error: 'Failed to initialize new chat conversation.' });
  }
});

/**
 * DELETE /api/chat/sessions/:id
 * Delete a chat session
 */
router.delete('/sessions/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true, message: 'Chat session deleted successfully.' });
  } catch (err) {
    console.error('Failed to delete session:', err);
    res.status(500).json({ error: 'Failed to delete chat session.' });
  }
});

/**
 * GET /api/chat/messages/:sessionId
 * Fetch messages for a specific session
 */
router.get('/messages/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { sessionId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Verify user owns the session
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or access denied.' });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Parse sources JSON
    const formatted = (messages || []).map(m => ({
      ...m,
      sources: typeof m.sources === 'string' ? JSON.parse(m.sources) : m.sources
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    res.status(500).json({ error: 'Failed to load conversation messages.' });
  }
});

/**
 * POST /api/chat/messages
 * Submit a prompt to the RAG chat agent
 */
router.post('/messages', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const { sessionId, prompt } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!sessionId || !prompt) {
    return res.status(400).json({ error: 'sessionId and prompt parameters are required.' });
  }

  try {
    // 1. Verify user owns the session
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied.' });
    }

    // 2. Invoke RAG query
    const result = await queryChatAgent(userId, sessionId, prompt);

    // 3. Update session title if it is "New Conversation" to user's prompt (concise version)
    if (session.title === 'New Conversation') {
      const summaryTitle = prompt.length > 30 ? `${prompt.slice(0, 27)}...` : prompt;
      await supabase
        .from('chat_sessions')
        .update({ title: summaryTitle })
        .eq('id', sessionId);
    }

    res.json(result);
  } catch (err) {
    console.error('Agent chat submission failed:', err);
    res.status(500).json({ error: 'Failed to generate assistant completion.' });
  }
});

export default router;
