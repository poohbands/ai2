# Family AI - Private Multi-User AI Chat (Phase 1 + Phase 2)

A privacy-focused AI chat application for family use, built with Next.js, Supabase, and Kob AI.

## Features

### Phase 1 (Core MVP)
- **Multi-user authentication** - Email/password with Supabase Auth
- **User isolation** - Each user only sees their own conversations and files
- **Multiple AI models** - Select from various models via Kob AI gateway
- **Streaming responses** - Real-time token streaming
- **File attachments** - Upload PDF, DOCX, CSV, XLSX, TXT, images
- **Vision support** - Analyze images with compatible models
- **Usage tracking** - Monitor token usage and costs per user
- **Budget controls** - Monthly budget limits with warnings
- **Admin dashboard** - Manage users, view statistics
- **Responsive UI** - Works on desktop, tablet, and mobile
- **Dark/Light mode** - System-aware theme switching

### Phase 2 (New)
- **Redis rate limiting** - Upstash Redis distributed limit with in-memory fallback (`/lib/rate-limit`)
- **OCR** - Tesseract.js (eng+tha) for images, scanned-PDF detection + Mistral OCR optional (`/lib/files/ocr.ts`)
- **Web Search** - Tavily / Brave / DuckDuckGo fallback, toggle `Web ON` in chat header (`/api/search`)
- **Deep Research** - multi-iteration plan→search→synthesize with streaming + citations (`/research`, `/api/research`)
- **RAG Knowledge Base** - pgvector, Kob embeddings, ingest + retrieve (`/knowledge`, `/api/kb`)
- **Memory** - long-term user memory with semantic recall, auto-injected into chat (`/api/memory`)
- **Prompt Library** - save/reuse system prompts (`/prompts`, `/api/prompts`)
- **Model Compare** - 2 models side-by-side streaming (`/compare`, `/api/compare`)
- **Image Generation** - Kob `/images/generations` (`/images`, `/api/images`)
- **Voice** - Web Speech STT (th-TH) + TTS in chat input

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **AI**: Kob AI (OpenAI-compatible API)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account
- Kob AI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure `.env.local` with your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   KOB_API_KEY=your_kob_api_key
   KOB_BASE_URL=https://api.kob.ai/v1
   NEXT_PUBLIC_APP_NAME=Family AI
   MAX_UPLOAD_SIZE_MB=10
   # Rate limiting (production): Upstash Redis, else in-memory fallback (dev only)
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   # OCR: tesseract (default) | mistral (needs key) | none
   OCR_PROVIDER=tesseract
   MISTRAL_API_KEY=
   # Web Search: Tavily > Brave > DuckDuckGo fallback (no key)
   TAVILY_API_KEY=
   BRAVE_API_KEY=
   # Embeddings + Image (via Kob OpenAI-compatible endpoints)
   EMBEDDING_MODEL=text-embedding-3-small
   EMBEDDING_DIMENSIONS=1536
   IMAGE_GEN_MODEL=flux-schnell
   ```

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations in order:
   ```bash
   # In Supabase SQL Editor, run each migration file:
   # 1. 20240101000001_initial_schema.sql
   # 2. 20240101000002_rls_policies.sql
   # 3. 20240101000003_seed_models.sql
   # 4. 20240101000004_updated_at_triggers.sql
   # 5. 20240101000005_auth_trigger.sql
   # 6. 20240101000006_phase2_rag_memory.sql  (pgvector + KB/memory/prompts/images)
   # 7. 20240101000007_vector_rpc.sql         (match_kb_chunks / match_memories)
   ```

3. Create Storage bucket:
   - Go to Storage in Supabase dashboard
   - Create bucket named `chat-files`
   - Set to **Private**
   - Add policies:
     ```sql
     -- Upload: users can upload to their own folder
     CREATE POLICY "Users can upload own files" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'chat-files' AND
       auth.uid()::text = (storage.foldername(name))[1]
     );

     -- Read: users can read their own files
     CREATE POLICY "Users can read own files" ON storage.objects
     FOR SELECT USING (
       bucket_id = 'chat-files' AND
       auth.uid()::text = (storage.foldername(name))[1]
     );

     -- Delete: users can delete their own files
     CREATE POLICY "Users can delete own files" ON storage.objects
     FOR DELETE USING (
       bucket_id = 'chat-files' AND
       auth.uid()::text = (storage.foldername(name))[1]
     );
     ```

4. Enable Email Auth:
   - Go to Authentication > Providers
   - Enable Email provider
   - Disable email confirmations for development (optional)

### Development

```bash
npm run dev
```

Open http://localhost:3000

### Creating First Admin

After registering your first account:

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE email = 'your-email@example.com';
   ```
3. Refresh the app and visit `/admin`

### Seeding Models

Models are seeded via migration `20240101000003_seed_models.sql`. To add more models:

```sql
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order)
VALUES
('model-id', 'Display Name', 'kob', 'Category', true, true, 0.000001, 0.000002, 100);
```

## Deployment to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Required Vercel Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KOB_API_KEY`
- `KOB_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `MAX_UPLOAD_SIZE_MB`
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (production rate limiting)
- `TAVILY_API_KEY` or `BRAVE_API_KEY` (optional, else DuckDuckGo fallback)
- `MISTRAL_API_KEY` (optional, scanned-PDF OCR)
- `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `IMAGE_GEN_MODEL`, `OCR_PROVIDER`

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── chat/          # Streaming chat endpoint
│   │   ├── models/        # Model listing
│   │   ├── upload/        # File upload
│   │   ├── search/        # Web search
│   │   ├── research/      # Deep Research (SSE)
│   │   ├── kb/            # Knowledge Base RAG
│   │   ├── memory/        # Long-term memory
│   │   ├── prompts/       # Prompt library
│   │   ├── images/        # Image generation
│   │   ├── compare/       # Model comparison
│   │   └── admin/         # Admin endpoints
│   ├── chat/              # Chat page
│   ├── research/          # Deep Research page
│   ├── knowledge/         # Knowledge Base page
│   ├── compare/           # Model Compare page
│   ├── images/            # Image Generation page
│   ├── prompts/           # Prompt Library page
│   ├── admin/             # Admin dashboard
│   └── auth pages         # Login, forgot/reset password
├── components/
│   ├── chat/              # Chat components
│   ├── sidebar/           # Sidebar with conversations
│   ├── admin/             # Admin components
│   ├── ui/                # shadcn/ui components
│   └── providers/         # Context providers
├── lib/
│   ├── ai/providers/      # AI provider abstraction
│   ├── supabase/          # Supabase clients
│   ├── auth/              # Auth utilities
│   ├── usage/             # Usage tracking & cost calculation
│   ├── files/             # File upload & extraction
│   ├── validation/        # Zod schemas
│   └── rate-limit/        # Rate limiting
└── types/                 # TypeScript types
```

## Privacy Model

- **Users** can only access their own conversations, messages, files, and usage
- **Admins** can see user metadata, usage statistics, and costs
- **Admins CANNOT** see chat content, message content, or file contents
- All data access enforced via Supabase Row Level Security (RLS)

## Known Limitations (updated: Phase 1 + Phase 2 done)

- Phase 2 implemented: Web Search, Deep Research, Image Generation, RAG Knowledge Base,
  Memory, Prompt Library, Model Comparison, Voice, Redis rate limiting, OCR (Tesseract + Mistral optional)
- Remaining: Agents / multi-step tool-use, scanned-PDF OCR without `MISTRAL_API_KEY`
  relies on Tesseract image OCR + Vision-model guidance only
- Rate limiting falls back to in-memory when Upstash env is empty (single-instance only)

## Testing Checklist

Before deployment, verify:

- [ ] User A can register and login
- [ ] User B can register and login
- [ ] User A cannot see User B's conversations
- [ ] User A cannot access User B's files
- [ ] Chat streaming works
- [ ] Stop generation works
- [ ] Conversation history persists
- [ ] Model selector works
- [ ] Disabled models cannot be selected
- [ ] File upload works (TXT, PDF, DOCX, CSV, XLSX, images)
- [ ] Vision models can analyze images
- [ ] Non-vision models reject images
- [ ] Budget warnings at 80%
- [ ] Budget block at 100%
- [ ] Admin can view stats
- [ ] Admin can manage users
- [ ] Admin cannot see chat content
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No secret leakage in client bundle

## License

Private family use only.