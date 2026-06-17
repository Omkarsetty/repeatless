import { query, supabase } from '../config/db';
import { generateEmbedding } from './ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

let genAI: GoogleGenerativeAI | null = null;
if (config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'placeholder_gemini_key') {
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
}

interface RetrievalResult {
  email_id: string;
  thread_id: string;
  content: string;
  similarity: number;
  subject?: string;
  from_address?: string;
  date?: string;
}

/**
 * Retrieve semantically relevant emails based on query text
 */
export async function retrieveRelevantContext(
  userId: string,
  userQuery: string,
  limit = 5,
  categoryFilter: string | null = null
): Promise<RetrievalResult[]> {
  try {
    // Generate query embedding
    const embedding = await generateEmbedding(userQuery);

    // Call PostgreSQL match_emails function via direct PG query
    const sql = `
      select * from match_emails(
        $1::vector, 
        $2::float, 
        $3::int, 
        $4::text, 
        $5::text
      )
    `;
    const threshold = 0.25; // Moderate similarity threshold
    const res = await query(sql, [JSON.stringify(embedding), threshold, limit, userId, categoryFilter]);
    const matches: RetrievalResult[] = res.rows;

    if (matches.length === 0) {
      return [];
    }

    // Fetch header details for each matching email to show citation details
    const emailIds = matches.map(m => m.email_id);
    const { data: emailsData } = await supabase
      .from('emails')
      .select('id, subject, from_address, date')
      .in('id', emailIds);

    const emailMap = new Map<string, any>();
    if (emailsData) {
      emailsData.forEach(e => emailMap.set(e.id, e));
    }

    return matches.map(m => {
      const emailDetails = emailMap.get(m.email_id);
      return {
        ...m,
        subject: emailDetails?.subject || 'No Subject',
        from_address: emailDetails?.from_address || 'Unknown Sender',
        date: emailDetails?.date || ''
      };
    });
  } catch (err) {
    console.error('Error retrieving RAG context:', err);
    return [];
  }
}

/**
 * RAG Chat Agent implementation with history and source citations
 */
export async function queryChatAgent(
  userId: string,
  sessionId: string,
  userPrompt: string
): Promise<{ content: string; sources: any[] }> {
  // 1. Fetch chat history for conversational context (max last 10 messages)
  const { data: historyMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(10);

  const formattedHistory = (historyMessages || [])
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  // 2. Retrieve relevant emails
  // We use both the user prompt and a bit of history context if available
  const contextQuery = historyMessages && historyMessages.length > 0
    ? `${historyMessages[historyMessages.length - 1].content} ${userPrompt}`
    : userPrompt;

  const contextResults = await retrieveRelevantContext(userId, contextQuery, 6);

  // Group unique email metadata to save as "sources" object
  const sourcesMap = new Map<string, any>();
  contextResults.forEach(r => {
    sourcesMap.set(r.email_id, {
      email_id: r.email_id,
      thread_id: r.thread_id,
      subject: r.subject,
      from: r.from_address,
      date: r.date
    });
  });
  const sources = Array.from(sourcesMap.values());

  // 3. Format context text for LLM prompt
  const formattedContext = contextResults
    .map((r, i) => `[Source #${i + 1}]
Email ID: ${r.email_id}
Thread ID: ${r.thread_id}
Sender: ${r.from_address}
Subject: ${r.subject}
Date: ${r.date}
Snippet:
${r.content.slice(0, 1000)}`)
    .join('\n\n====================\n\n');

  // 4. Construct instruction and query prompt
  const systemPrompt = `You are a helpful AI Gmail Assistant representing the Gmail Intelligence Platform.
You have access to the user's emails. You must answer the user's question using ONLY the provided email context.

STRICT RULES:
1. Grounding: Rely ONLY on the information in the emails. If you cannot find the answer in the provided emails, clearly state: "I couldn't find any information about that in your synced email history." Do not make up any facts, names, dates, or emails.
2. Source Clarity & Attribution: Every time you mention a fact, decision, rejection, project detail, or quote, you MUST cite its source like [Source #1], [Source #2], etc., matching the index in the retrieved context.
3. Cross-Email Reasoning: Synthesize information across multiple senders/threads if requested (e.g. Acme Corp emails, Job applications). Collate, group, or list them clearly.
4. Professionalism: Keep your responses clear, helpful, and concise.

Retrieved Email Context:
${formattedContext || 'No email records found matching query.'}

Conversation History:
${formattedHistory || 'No previous messages.'}

Current User Question:
"${userPrompt}"

Response:`;

  let responseText = '';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(systemPrompt);
      responseText = result.response.text().trim();
    } catch (err) {
      console.error('Gemini RAG Query failed:', err);
      responseText = 'Error generating response from Gemini API.';
    }
  } else {
    // Offline/Mock simulation
    console.warn('[Mock Chat Agent] Gemini API key not set. Simulating agent response.');
    responseText = `This is a simulated AI Agent response in Offline Mode.\n\nI searched your emails for "${userPrompt}" and found ${sources.length} matching references. Since Gemini is not configured, here is a breakdown based on the mock data database:\n\n` +
      sources.map((s, idx) => `- Reference #${idx + 1}: Email from "${s.from}" regarding "${s.subject}" on ${s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}.`).join('\n') +
      `\n\nTo see real Gemini intelligence, please set a valid GEMINI_API_KEY in the backend .env file.`;
  }

  // 5. Save user message and assistant message to DB
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: userPrompt
  });

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: responseText,
    sources: JSON.stringify(sources)
  });

  // Update session updated_at timestamp
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date() })
    .eq('id', sessionId);

  return {
    content: responseText,
    sources
  };
}
