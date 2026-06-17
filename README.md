# Gmail Intelligence Platform

An AI-powered dashboard that securely connects to Gmail via Google OAuth 2.0, synchronizes inbox emails and threads, classifies them into semantic categories, provides automated Gemini email/thread summaries, and integrates a conversational RAG Chat Agent with strict citation references. It also includes an NVIDIA NIM semantic deduplication panel for newsletter digests.

---

## Folder Structure

```text
├── backend/
│   ├── src/
│   │   ├── config/       # Environment loading & DB Pool configs
│   │   ├── controllers/  # REST routers (Auth, Email, Chat, Newsletter)
│   │   ├── db/           # Seeding logic for sandbox testing
│   │   ├── middleware/   # JWT verification middleware
│   │   ├── services/     # Gmail client sync & LLM RAG pipelines
│   │   └── index.ts      # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/   # React Dashboard, Inbox, Chat, and Newsletters
│   │   ├── styles/       # theme.css & layout rules
│   │   ├── App.tsx       # State management & views routing
│   │   └── main.tsx      # Mount script
│   ├── package.json
│   └── vite.config.ts
├── schema.sql            # Database schema for Supabase
├── Architecture.md       # Technical Design & Architecture Documentation
└── README.md             # This guide
```

---

## 1. Database Setup (Supabase)

The database utilizes PostgreSQL and the `pgvector` extension. 
1. Create a project in [Supabase](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste the contents of [schema.sql](file:///c:/Users/medis/Downloads/New%20folder/schema.sql) and click **Run**. This will enable the vector extension, create all necessary tables, set up query indices, and declare the `match_emails` proximity search function.

---

## 2. Environment Variables

Create a file named `.env` inside the `backend/` directory using [backend/.env](file:///c:/Users/medis/Downloads/New%20folder/backend/.env) as a guideline. Supply the following configurations:

```text
PORT=3001
JWT_SECRET=any_jwt_secret_signing_key

# Google OAuth (Gmail API credentials)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Supabase API Credentials
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database Connection Pool URL (found in Supabase Settings -> Database -> Connection string)
DATABASE_URL=your_supabase_direct_postgres_url

# Primary AI Model API key
GEMINI_API_KEY=your_google_gemini_api_key

# Secondary AI Model (NVIDIA NIM api key)
NVIDIA_API_KEY=your_nvidia_nim_api_key
```

---

## 3. Running the Application

### Backend Service (Port 3001)

1. Open a terminal inside the `backend/` directory.
2. If dependencies are not installed, run:
   ```bash
   npm install
   ```
   *(On Windows PowerShell, use `npm.cmd install` if script execution is restricted).*
3. Launch the development server:
   ```bash
   npm run dev
   ```
   *(Or `npm.cmd run dev`).*

The server compiles TypeScript and starts listening on `http://localhost:3001`. It will report whether it is running in **Connected Production Mode** or **Offline Demo Sandbox Mode** based on env variable availability.

### Frontend Application (Port 3000)

1. Open a terminal inside the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
   *(Or `npm.cmd install`).*
3. Launch the Vite dev server:
   ```bash
   npm run dev
   ```
   *(Or `npm.cmd run dev`).*

Open `http://localhost:3000` in your web browser.

---

## 4. Evaluation Guide (Demo Sandbox Mode)

If you do not have Google API keys or a Supabase instance ready, you can evaluate all features immediately using the **Offline Demo Sandbox Mode**:

1. Start both the backend and frontend dev servers.
2. Open `http://localhost:3000`.
3. Click the **Start Offline Demo Sandbox** button.
4. The system will bypass Google auth, seed the database with synthetic data (including job rejections, corporate project logs, invoices, newsletters, and matching vector embeddings), and issue a session token.
5. You can now:
   - **Dashboard:** Review metrics and category folders split.
   - **Inbox:** Filter threads by category (All, Newsletters, Job, Finance, Work, Personal), view chronologically grouped messages, check AI thread summaries, prompt the AI to draft replies, edit, and click "Send".
   - **AI Chat Agent:** Create conversations and ask queries:
     - *"Who rejected my job application? List them all."*
     - *"What is discussed about Kubernetes?"*
     - Click referenced **Citation Badges** (`[1]`, `[2]`) in the chat bubbles to pop up the exact source email.
   - **Newsletter Digest:** Select the timeframe filter to compile tech news stories, semantically deduplicating overlaps across separate TLDR / Hacker News letters with citation source pills.
