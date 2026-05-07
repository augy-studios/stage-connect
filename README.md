# Stage Connect

Join a live interactive stage — polls, Q&A, quizzes, and more.

- **Main app (presenter):** `stage.uwuapps.org` → `main/`
- **Live view (audience):** `live.stage.uwuapps.org/:slug` → `live/`

---

## Repo Structure

```bash
stage-connect/
├── main/              → Vercel project 1: stage.uwuapps.org
│   ├── public/        → Static frontend (HTML, CSS, JS, PWA)
│   ├── api/           → Serverless functions
│   │   ├── auth/      → register, login, logout, me
│   │   ├── stages/    → create, list, publish, unpublish
│   │   └── interactions/ → poll, qa, quiz, survey, wordcloud, reaction, chat, comment
│   ├── lib/           → Shared helpers (supabase.js, auth.js)
│   ├── package.json
│   └── vercel.json
│
├── live/              → Vercel project 2: live.stage.uwuapps.org
│   ├── public/        → Audience-facing HTML/CSS/JS
│   ├── api/stage/     → Edge function: [slug].js
│   └── vercel.json
│
├── shared/
│   └── db-schema.sql  → All Supabase table definitions
│
└── README.md
```

---

## Deployment

### 1. Supabase Setup

1. Create a Supabase project.
2. Run `shared/db-schema.sql` in the SQL editor.
3. Ensure you have existing `uwu_users` and `uwu_sessions` tables (shared with other uwuapps).
4. Copy your **Project URL** and **Service Role Key** (not the anon key).
5. Optionally enable Realtime for the tables listed at the bottom of the SQL file.

### 2. GitHub

Push this entire folder as a single public GitHub repo.

### 3. Vercel — Two Projects

**Project 1 (main presenter app):**

- Import the repo in Vercel
- Set Root Directory: `main`
- Add env vars:
  - `SUPABASE_URL` = your Supabase project URL
  - `SUPABASE_SERVICE_KEY` = your service role key
- Assign custom domain: `stage.uwuapps.org`

**Project 2 (live audience view):**

- Import the same repo in Vercel again
- Set Root Directory: `live`
- Add env vars:
  - `SUPABASE_URL` = same
  - `SUPABASE_SERVICE_KEY` = same
  - `MAIN_API_URL` = `https://stage.uwuapps.org`
- Assign custom domain: `live.stage.uwuapps.org`

### 4. Icons

Place your own `icon-192.png` and `icon-512.png` in:

- `main/public/icons/`
- `live/public/icons/` (or symlink — Vercel doesn't support symlinks; copy them)

---

## VPS

**Not required.** Everything runs on Vercel + Supabase. Your Debian VPS is not needed for this project.

---

## Features

| Feature | Presenter controls | Audience action |
| --- | --- | --- |
| Polls | Create, toggle active, view live bars | Vote once |
| Word Cloud | View, clear | Submit a word |
| Q&A | Pin, mark answered, hide | Submit question, vote |
| Quiz | Create questions, activate, view answers | Answer with countdown |
| Surveys | Create multi-question surveys | Submit once |
| Reactions | View counts live | Tap reaction |
| Chat | View, clear all | Send message |
| Comments | View, hide, vote counts | Post, upvote/downvote |

---

## How Slug/Go Live Works

1. Presenter clicks **Go Live**, enters a slug (e.g. `my-event`)
2. App calls `POST /api/stages/publish` → sets `is_live=true`, `slug=my-event`
3. Audience visits `live.stage.uwuapps.org/my-event`
4. Edge function `live/api/stage/[slug].js` fetches stage data from Supabase
5. `live.html` loads and calls the main API on `stage.uwuapps.org` for all interactions
6. When presenter clicks **End Session**, `POST /api/stages/unpublish` → sets `is_live=false`, `slug=null` (slug is released for anyone else to use)
