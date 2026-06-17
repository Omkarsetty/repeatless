-- Supabase Database Schema Setup
-- Enable the pgvector extension to allow vector stores for semantic search RAG
create extension if not exists vector;

-- User Accounts / OAuth credentials table
create table if not exists accounts (
  id text primary key, -- Google user ID
  email text not null unique,
  access_token text not null,
  refresh_token text,
  token_expiry timestamp with time zone,
  last_sync_time timestamp with time zone,
  last_history_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Email Threads Table
create table if not exists threads (
  id text primary key, -- Gmail Thread ID
  user_id text not null references accounts(id) on delete cascade,
  summary text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Email Messages Table
create table if not exists emails (
  id text primary key, -- Gmail Message ID
  thread_id text not null references threads(id) on delete cascade,
  user_id text not null references accounts(id) on delete cascade,
  subject text,
  from_address text,
  to_addresses text[],
  cc_addresses text[],
  bcc_addresses text[],
  date timestamp with time zone,
  body_text text,
  body_html text,
  snippet text,
  label_ids text[],
  category text, -- Newsletters, Job / Recruitment, Finance, Notifications, Personal, Work / Professional
  summary text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Email Vector Embeddings Table for RAG
create table if not exists email_embeddings (
  id uuid primary key default gen_random_uuid(),
  email_id text not null references emails(id) on delete cascade,
  thread_id text not null references threads(id) on delete cascade,
  user_id text not null references accounts(id) on delete cascade,
  content text not null, -- Plain text section that was embedded
  embedding vector(768) not null, -- 768 dimensions for Google Gemini text-embedding-004
  created_at timestamp with time zone default now()
);

-- Chat Agent Sessions
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references accounts(id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat Agent Messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]'::jsonb, -- Store list of email/thread references with subject, sender, date
  created_at timestamp with time zone default now()
);

-- Indexing for performance queries
create index if not exists idx_emails_thread_id on emails(thread_id);
create index if not exists idx_emails_user_id on emails(user_id);
create index if not exists idx_emails_category on emails(category);
create index if not exists idx_emails_date on emails(date);
create index if not exists idx_email_embeddings_email_id on email_embeddings(email_id);
create index if not exists idx_email_embeddings_thread_id on email_embeddings(thread_id);
create index if not exists idx_chat_messages_session_id on chat_messages(session_id);

-- Custom PostgreSQL search function for pgvector queries
create or replace function match_emails (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id text,
  p_category text default null
)
returns table (
  email_id text,
  thread_id text,
  content text,
  similarity float
)
language plpgsql stable
as $$
begin
  return query
  select
    ee.email_id,
    ee.thread_id,
    ee.content,
    1 - (ee.embedding <=> query_embedding) as similarity
  from email_embeddings ee
  where ee.user_id = p_user_id
    and (p_category is null or exists (
      select 1 from emails e where e.id = ee.email_id and e.category = p_category
    ))
    and 1 - (ee.embedding <=> query_embedding) > match_threshold
  order by ee.embedding <=> query_embedding
  limit match_count;
end;
$$;
