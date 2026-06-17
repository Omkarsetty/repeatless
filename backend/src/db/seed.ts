import { supabase, query } from '../config/db';
import { generateEmbedding } from '../services/ai';

export async function seedMockData(userId: string) {
  console.log(`[Seed Log] Starting mock data seeding for user: ${userId}`);

  // Define mock threads
  const mockThreads = [
    {
      id: 'thread-job-stripe',
      summary: 'Stripe recruiter updates user about their Software Engineer application. They are scheduled for a round of interviews.'
    },
    {
      id: 'thread-job-google',
      summary: 'Google Careers sends a rejection notification regarding the application for AI Engineer role, thanking them for their time.'
    },
    {
      id: 'thread-acme-project',
      summary: 'Acme Corp team discussion on the database migration project. The migration has been delayed due to Kubernetes setup issues.'
    },
    {
      id: 'thread-newsletter-tldr',
      summary: 'TLDR Newsletter listing weekly tech updates. Includes news about Kubernetes 1.31 release, Nvidia new AI chips, and OpenAI developments.'
    },
    {
      id: 'thread-newsletter-hn',
      summary: 'Hacker News digest containing popular articles about self-hosting, Kubernetes 1.31, and PostgreSQL scaling strategies.'
    },
    {
      id: 'thread-finance-invoice',
      summary: 'Supabase sends invoice details showing a charge of $25.00 for the Pro Plan, marked as successfully paid.'
    },
    {
      id: 'thread-personal-coffee',
      summary: 'Personal thread from Sarah asking to meet for coffee on Friday to catch up.'
    }
  ];

  // Insert threads
  for (const t of mockThreads) {
    console.log(`[Seed Log] Checking thread: ${t.id}`);
    try {
      const { data: ext, error } = await supabase.from('threads').select('id').eq('id', t.id).single();
      if (error && error.code !== 'PGRST116') {
        console.error(`[Seed Log] Supabase select error for thread ${t.id}:`, error);
      }
      
      if (!ext) {
        console.log(`[Seed Log] Inserting thread: ${t.id}`);
        const { error: insErr } = await supabase.from('threads').insert({
          id: t.id,
          user_id: userId,
          summary: t.summary
        });
        if (insErr) {
          console.error(`[Seed Log] Supabase insert error for thread ${t.id}:`, insErr);
        }
      } else {
        console.log(`[Seed Log] Thread ${t.id} already exists.`);
      }
    } catch (err) {
      console.error(`[Seed Log] Exception checking/inserting thread ${t.id}:`, err);
    }
  }

  // Define mock emails
  const mockEmails = [
    {
      id: 'email-job-stripe-1',
      thread_id: 'thread-job-stripe',
      subject: 'Interview Schedule: Software Engineer at Stripe',
      from_address: 'recruitment@stripe.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 3).toISOString(), // 3 days ago
      body_text: `Hi Candidate,

We loved your profile! We would like to schedule you for a technical assessment and coding round for the Software Engineer position.
Please let us know your availability for this week.

Best,
Stripe Recruiting Team`,
      snippet: 'Stripe recruitment wants to schedule coding round for Software Engineer role.',
      category: 'Job / Recruitment',
      summary: 'Stripe recruitment team requesting availability for a technical interview.'
    },
    {
      id: 'email-job-google-1',
      thread_id: 'thread-job-google',
      subject: 'Google Application Update: AI Specialist',
      from_address: 'no-reply@careers.google.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 5).toISOString(), // 5 days ago
      body_text: `Thank you for your interest in the AI Specialist position at Google.

We reviewed your application carefully. Unfortunately, we will not be moving forward with your application at this time as we are looking for candidates with alternative specialties.
We will keep your resume on file.

Sincerely,
Google Careers Team`,
      snippet: 'Google regrets to inform that candidate was rejected for AI Specialist position.',
      category: 'Job / Recruitment',
      summary: 'Google Careers sending polite application rejection for AI Specialist position.'
    },
    {
      id: 'email-acme-1',
      thread_id: 'thread-acme-project',
      subject: 'Data Migration Project Status',
      from_address: 'manager@acmecorp.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 2).toISOString(), // 2 days ago
      body_text: `Team,

Regarding the database migration project, we are running into issues with our Kubernetes setup. The pods are crashing because of insufficient resources.
We are pushing the database migration go-live date by 1 week to resolve Kubernetes clusters capacity.

Regards,
Project Manager`,
      snippet: 'Acme Project Manager says migration project is delayed by 1 week due to Kubernetes issues.',
      category: 'Work / Professional',
      summary: 'Manager announces 1-week migration delay due to Kubernetes pod crashes.'
    },
    {
      id: 'email-acme-2',
      thread_id: 'thread-acme-project',
      subject: 'Re: Data Migration Project Status',
      from_address: 'devops-lead@acmecorp.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 1.5).toISOString(), // 1.5 days ago
      body_text: `Hi all,

I investigated the Kubernetes crashing pods. We need to allocate 8GB memory limits instead of 4GB for the database containers.
I will apply the YAML update today to resolve the crash.

DevOps Lead`,
      snippet: 'DevOps lead suggests allocation of 8GB memory limits in Kubernetes config to fix crashes.',
      category: 'Work / Professional',
      summary: 'DevOps lead proposes memory limit increases to resolve the Kubernetes pod crashes.'
    },
    {
      id: 'email-newsletter-tldr-1',
      thread_id: 'thread-newsletter-tldr',
      subject: 'TLDR Web Dev: Kubernetes 1.31 released & OpenAI updates',
      from_address: 'newsletters@tldr.tech',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 1).toISOString(), // 1 day ago
      body_text: `TLDR Tech News - June 2026

** KUBERNETES 1.31 RELEASED **
Kubernetes 1.31 brings support for new volume plugins, improved network policies, and minor bug fixes for autoscalers.

** OPENAI INTRODUCES NEW AGENT SUITE **
OpenAI released a developer kit for multi-agent workflows, supporting synchronous message passing and state memory.

** STRIPE LAUNCHES EMBEDDED CHECKOUTS **
Stripe launches its new Embedded Checkout SDK allowing direct payments inside page frames.`,
      snippet: 'Tech updates including Kubernetes 1.31 launch, OpenAI agent suite, and Stripe checkouts.',
      category: 'Newsletters',
      summary: 'TLDR Tech newsletter covering Kubernetes 1.31, OpenAI agent kits, and Stripe embedded checkouts.'
    },
    {
      id: 'email-newsletter-hn-1',
      thread_id: 'thread-newsletter-hn',
      subject: 'Hacker News Digest: self-hosting Kubernetes and Stripe APIs',
      from_address: 'hn-weekly@digest.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 0.8).toISOString(), // 0.8 days ago
      body_text: `Hacker News Top Stories:

1. Kubernetes 1.31 released (kubernetes.io) - 450 points.
Kubernetes 1.31 was announced yesterday with enhanced auto-scaling algorithms and network security adjustments.

2. Why we self-host our SaaS database (github.blog) - 300 points.
A deep dive into why moving away from cloud databases saved $200k.

3. Testing Stripe new Embedded Checkout (stripe.dev) - 150 points.
Developers share templates for using the newly announced Stripe Embedded Checkout frames.`,
      snippet: 'HN weekly stories featuring Kubernetes 1.31 release details, database self-hosting benefits, and Stripe checkouts.',
      category: 'Newsletters',
      summary: 'Hacker News digest detailing Kubernetes 1.31 release discussions and Stripe checkout feedback.'
    },
    {
      id: 'email-finance-supabase-1',
      thread_id: 'thread-finance-invoice',
      subject: 'Supabase Invoice #SUB-4890 - Paid',
      from_address: 'billing@supabase.io',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 4).toISOString(), // 4 days ago
      body_text: `Thank you for your business.

We have successfully charged $25.00 to your card on file for your Supabase Pro Plan (Project: repeatless-platform).
No further action is required.

Supabase Billing team`,
      snippet: 'Supabase invoice for $25.00 paid successfully.',
      category: 'Finance',
      summary: 'Invoice confirmation from Supabase billing for $25.00 for the Pro Plan.'
    },
    {
      id: 'email-personal-coffee-1',
      thread_id: 'thread-personal-coffee',
      subject: 'Coffee this Friday?',
      from_address: 'sarah.jones@example.com',
      date: new Date(Date.now() - 1000 * 3600 * 24 * 0.5).toISOString(), // 12 hours ago
      body_text: `Hey!

Are you free to catch up for coffee this Friday afternoon around 3 PM?
Let me know if the usual spot works.

Sarah`,
      snippet: 'Sarah wants to meet for coffee on Friday at 3 PM.',
      category: 'Personal',
      summary: 'Sarah Jones asking to meet for coffee on Friday at 3 PM.'
    }
  ];

  // Insert mock emails and their vector embeddings
  for (const m of mockEmails) {
    console.log(`[Seed Log] Checking email: ${m.id}`);
    try {
      const { data: ext, error } = await supabase.from('emails').select('id').eq('id', m.id).single();
      if (error && error.code !== 'PGRST116') {
        console.error(`[Seed Log] Supabase select error for email ${m.id}:`, error);
      }

      if (!ext) {
        console.log(`[Seed Log] Inserting email: ${m.id}`);
        const { error: insErr } = await supabase.from('emails').insert({
          id: m.id,
          thread_id: m.thread_id,
          user_id: userId,
          subject: m.subject,
          from_address: m.from_address,
          to_addresses: [userId],
          date: m.date,
          body_text: m.body_text,
          snippet: m.snippet,
          category: m.category,
          summary: m.summary,
          processed_at: new Date()
        });

        if (insErr) {
          console.error(`[Seed Log] Supabase insert error for email ${m.id}:`, insErr);
          continue;
        }

        // Generate embedding
        console.log(`[Seed Log] Requesting Gemini embedding for email: ${m.id}`);
        const embeddedText = `From: ${m.from_address}\nSubject: ${m.subject}\nSnippet: ${m.snippet}\nBody: ${m.body_text}`;
        const embedding = await generateEmbedding(embeddedText);
        console.log(`[Seed Log] Embedding received for ${m.id}. Length: ${embedding.length}`);

        // Store in vector table
        console.log(`[Seed Log] Inserting vector embedding into DB for email: ${m.id}`);
        await query(
          `insert into email_embeddings (email_id, thread_id, user_id, content, embedding)
           values ($1, $2, $3, $4, $5::vector)
           on conflict do nothing`,
          [m.id, m.thread_id, userId, embeddedText, JSON.stringify(embedding)]
        );
        console.log(`[Seed Log] Stored vector embedding successfully for: ${m.id}`);
      } else {
        console.log(`[Seed Log] Email ${m.id} already exists.`);
      }
    } catch (err) {
      console.error(`[Seed Log] Exception processing email ${m.id}:`, err);
    }
  }

  console.log(`[Seed Log] Seeding successfully completed for user ${userId}.`);
}
