import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config, isConfigReady } from '../config/env';

// Initialize Gemini SDK
let genAI: GoogleGenerativeAI | null = null;
if (config.GEMINI_API_KEY && 
    config.GEMINI_API_KEY !== 'placeholder_gemini_key' && 
    !config.GEMINI_API_KEY.toLowerCase().startsWith('placeholder_')) {
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
}

// Initialize NVIDIA NIM OpenAI client
let nvidiaClient: OpenAI | null = null;
if (config.NVIDIA_API_KEY && 
    config.NVIDIA_API_KEY !== 'placeholder_nvidia_key' && 
    !config.NVIDIA_API_KEY.toLowerCase().startsWith('placeholder_')) {
  nvidiaClient = new OpenAI({
    apiKey: config.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
}

// Helper to check if APIs are online
export function isAiReady(): boolean {
  return genAI !== null;
}

/**
 * Generate a vector embedding for a piece of text using Gemini's text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    console.warn('[Mock Embedding] Gemini API key not set. Generating mock 768-dim vector.');
    return Array.from({ length: 768 }, () => Math.random());
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error('Error generating embedding:', err);
    // Fallback vector
    return Array.from({ length: 768 }, () => Math.random());
  }
}

/**
 * Categorize an email using NVIDIA NIM (Llama 3.1 70B Instruct)
 * Fallback to Gemini if NIM is not configured, or static regex rules
 */
export async function categorizeEmail(
  subject: string,
  from: string,
  snippet: string,
  bodyText: string
): Promise<string> {
  const categories = [
    'Newsletters',
    'Job / Recruitment',
    'Finance',
    'Notifications',
    'Personal',
    'Work / Professional'
  ];

  const contentSample = `Subject: ${subject}\nFrom: ${from}\nSnippet: ${snippet}\nBody: ${bodyText.slice(0, 1000)}`;

  if (nvidiaClient) {
    try {
      const response = await nvidiaClient.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          {
            role: 'system',
            content: `You are an email categorization assistant. Categorize the given email into exactly ONE of the following categories:
- Newsletters (newsletters, blogs, digests, subscriptions)
- Job / Recruitment (resumes, interviews, application updates, job offers, rejections)
- Finance (bank alerts, receipts, invoices, statements, payments)
- Notifications (OTP, sign-ups, system alerts, password resets, GitHub updates, automated alerts)
- Personal (informal, chat, friends, family, direct human-to-human personal emails)
- Work / Professional (work tasks, project coordination, scheduling work, team syncs, official corporate notices)

Output ONLY the exact category name. Do not include explanation, punctuation, or extra spaces. Example output: "Finance"`
          },
          { role: 'user', content: contentSample }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      const resultText = response.choices[0]?.message?.content?.trim() || '';
      const matched = categories.find(c => resultText.toLowerCase().includes(c.toLowerCase()));
      if (matched) return matched;
    } catch (err) {
      console.error('NVIDIA NIM categorization failed, falling back to Gemini/rules:', err);
    }
  }

  // Fallback 1: Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Categorize the following email into exactly ONE of these categories:
- Newsletters
- Job / Recruitment
- Finance
- Notifications
- Personal
- Work / Professional

Email:
${contentSample}

Response (Output ONLY the exact category name):`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const matched = categories.find(c => text.toLowerCase().includes(c.toLowerCase()));
      if (matched) return matched;
    } catch (err) {
      console.error('Gemini fallback categorization failed:', err);
    }
  }

  // Fallback 2: Basic keyword heuristic rules (if offline)
  const lowerSubject = subject.toLowerCase();
  const lowerBody = bodyText.toLowerCase();

  if (lowerSubject.includes('invoice') || lowerSubject.includes('payment') || lowerSubject.includes('receipt') || lowerSubject.includes('bill') || lowerSubject.includes('bank') || lowerSubject.includes('statement')) {
    return 'Finance';
  }
  if (lowerSubject.includes('job') || lowerSubject.includes('interview') || lowerSubject.includes('career') || lowerSubject.includes('resume') || lowerSubject.includes('application') || lowerSubject.includes('offer')) {
    return 'Job / Recruitment';
  }
  if (lowerSubject.includes('newsletter') || lowerSubject.includes('digest') || lowerSubject.includes('weekly') || lowerSubject.includes('daily') || lowerSubject.includes('subscribe')) {
    return 'Newsletters';
  }
  if (lowerSubject.includes('otp') || lowerSubject.includes('verify') || lowerSubject.includes('verification') || lowerSubject.includes('code') || lowerSubject.includes('alert') || lowerSubject.includes('password reset') || lowerSubject.includes('notification')) {
    return 'Notifications';
  }
  if (lowerSubject.includes('meeting') || lowerSubject.includes('project') || lowerSubject.includes('sync') || lowerSubject.includes('roadmap') || lowerSubject.includes('task') || lowerSubject.includes('feedback')) {
    return 'Work / Professional';
  }

  return 'Personal';
}

/**
 * Summarize a single email using Gemini
 */
export async function summarizeEmail(
  subject: string,
  from: string,
  bodyText: string
): Promise<string> {
  if (!genAI) {
    return `[Summary Preview] Email from ${from} regarding "${subject}". (Simulated summary: discuss updates and details).`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the following email in 2 sentences or less. Keep it concise. Focus on who sent it, why, and what action is required.
    
Subject: ${subject}
From: ${from}
Content:
${bodyText.slice(0, 3000)}`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error generating email summary:', err);
    return 'Failed to generate summary.';
  }
}

/**
 * Summarize an entire email thread using Gemini
 */
export async function summarizeThread(
  messages: { subject: string; from: string; bodyText: string; date: string }[]
): Promise<string> {
  if (!genAI) {
    return `[Thread Summary Preview] Discussion of "${messages[0]?.subject}". Contains ${messages.length} messages. Summarizing main talking points and resolutions.`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const messageStack = messages
      .map((m, i) => `Message #${i + 1}\nFrom: ${m.from}\nDate: ${m.date}\nContent:\n${m.bodyText.slice(0, 1500)}`)
      .join('\n\n---\n\n');

    const prompt = `You are an assistant summarizing an email thread conversation. Provide a concise paragraph summarizing the entire conversation arc:
1. What was the original email about?
2. What are the main discussion points or concerns raised in subsequent messages?
3. What is the current status or decision, and what (if any) are the next actions/next steps?

Thread Messages (oldest to newest):
${messageStack}

Concisely summarize the thread:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error generating thread summary:', err);
    return 'Failed to generate thread summary.';
  }
}

/**
 * Generate a reply draft preserving the thread context
 */
export async function generateReplyDraft(
  prompt: string,
  messages: { subject: string; from: string; bodyText: string; date: string }[]
): Promise<string> {
  if (!genAI) {
    return `Hi team,\n\nThis is a mock draft generated from your prompt: "${prompt}".\n\nBest regards,\nUser`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const messageStack = messages
      .map((m, i) => `[Message #${i + 1}] From: ${m.from} | Date: ${m.date} | Snippet: ${m.bodyText.slice(0, 1000)}`)
      .join('\n');

    const promptText = `You are drafting a professional reply email. Here is the context of the conversation thread so far:
${messageStack}

User Instructions for drafting the reply:
"${prompt}"

Draft a complete, polite, and contextual reply email. Do not include email headers (To/Subject/From), just draft the body of the message. Start with a greeting and end with a sign-off.`;

    const result = await model.generateContent(promptText);
    return result.response.text().trim();
  } catch (err) {
    console.error('Error generating reply draft:', err);
    return 'Failed to generate reply draft.';
  }
}

/**
 * Generate a brand new email draft from a natural-language prompt
 */
export async function generateNewEmailDraft(prompt: string): Promise<{ subject: string; body: string }> {
  if (!genAI) {
    return {
      subject: 'Follow-up Draft',
      body: `Hi,\n\nThis is a mock draft based on prompt: "${prompt}".\n\nSincerely,\nUser`
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const promptText = `You are drafting a new, professional email. Here are the user's instructions:
"${prompt}"

Please generate both a suitable, professional subject line and the email body.
Output format:
Subject: <subject>
Body:
<body>

Do not add extra characters. Generate standard greeting, body, and sign-off.`;

    const result = await model.generateContent(promptText);
    const text = result.response.text().trim();

    // Parse Subject and Body
    let subject = 'New Email Draft';
    let body = text;

    if (text.startsWith('Subject:')) {
      const firstLineBreak = text.indexOf('\n');
      subject = text.slice(8, firstLineBreak).trim();
      const bodyPart = text.slice(firstLineBreak).replace(/^\s*Body:\s*/i, '').trim();
      body = bodyPart;
    }

    return { subject, body };
  } catch (err) {
    console.error('Error generating new email draft:', err);
    return { subject: 'Draft Error', body: 'Failed to draft email.' };
  }
}

/**
 * Deduplicate newsletter articles using NVIDIA NIM (Llama 3.1 70B Instruct)
 * Fallback to Gemini if NIM is not configured
 */
export async function deduplicateNewsletters(
  items: { id: string; subject: string; from: string; snippet: string; body: string; date: string }[]
): Promise<any[]> {
  if (items.length === 0) return [];

  // Group emails to feed into prompt
  const newsletterData = items.map((item, idx) => ({
    index: idx,
    id: item.id,
    source: item.from,
    subject: item.subject,
    date: item.date,
    snippet: item.snippet,
    content: item.body.slice(0, 1200)
  }));

  const systemPrompt = `You are an editor synthesizing tech news from newsletters. Multiple newsletters may carry similar or identical stories.
Your task is to identify and list distinct news stories, deduplicating them based on semantic similarity.
For each distinct story you find, provide:
1. Title: A clean, concise title for the news story.
2. Summary: A 1-2 sentence description of the news story.
3. Sources: An array of source indices (referencing the items provided) that carried this story.

Input format: A JSON array of newsletter articles.
Output format: A JSON array of unique stories, like:
[
  {
    "title": "Story Title Here",
    "summary": "Short 1-2 sentence summary of this story.",
    "sources": [0, 2]
  }
]
Output ONLY valid JSON. No markdown backticks, no explanations.`;

  const userContent = JSON.stringify(newsletterData);

  // Attempt using NVIDIA NIM
  if (nvidiaClient) {
    try {
      const response = await nvidiaClient.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
      });

      const responseText = response.choices[0]?.message?.content?.trim() || '[]';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const stories = JSON.parse(cleanJson);
      
      // Map sources back
      return mapStoriesToSources(stories, items);
    } catch (err) {
      console.error('NVIDIA NIM newsletter deduplication failed, falling back to Gemini:', err);
    }
  }

  // Fallback: Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `${systemPrompt}\n\nInput Newsletter Articles:\n${userContent}`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const stories = JSON.parse(cleanJson);
      return mapStoriesToSources(stories, items);
    } catch (err) {
      console.error('Gemini newsletter deduplication failed, returning raw items:', err);
    }
  }

  // Ultimate fallback: return raw newsletter items formatted as stories
  return items.map(item => ({
    title: item.subject || 'News Story',
    summary: item.snippet || item.body.slice(0, 150),
    sources: [{
      email_id: item.id,
      from: item.from,
      subject: item.subject,
      date: item.date
    }]
  }));
}

function mapStoriesToSources(stories: any[], originalItems: any[]): any[] {
  return stories.map((story: any) => {
    const sources = (story.sources || [])
      .map((idx: number) => {
        const item = originalItems[idx];
        if (!item) return null;
        return {
          email_id: item.id,
          from: item.from,
          subject: item.subject,
          date: item.date
        };
      })
      .filter((s: any) => s !== null);

    return {
      title: story.title,
      summary: story.summary,
      sources
    };
  });
}
