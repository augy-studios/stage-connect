-- =============================================================
-- Stage Connect — Supabase Schema
-- All tables use the "uwustage_" prefix
-- Requires existing uwu_users and uwu_sessions tables
-- =============================================================

-- STAGES
create table public.uwustage_stages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references uwu_users(id) on delete cascade,
  title text not null,
  description text null,
  slug text null unique,              -- null when not live; set on "Go Live"
  is_live boolean not null default false,
  features text[] not null default '{}', -- e.g. ['poll','qa','quiz','wordcloud',...]
  settings jsonb null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ended_at timestamptz null,
  constraint uwustage_stages_pkey primary key (id)
);

create index idx_uwustage_stages_slug on public.uwustage_stages(slug) where slug is not null;
create index idx_uwustage_stages_user on public.uwustage_stages(user_id);

-- POLLS
create table public.uwustage_polls (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]', -- [{id: string, text: string, votes: number}]
  is_active boolean default true,
  created_at timestamptz default now()
);

-- POLL VOTES (one vote per anonymous token per poll)
create table public.uwustage_poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid not null references uwustage_polls(id) on delete cascade,
  option_id text not null,
  voter_token text not null,
  created_at timestamptz default now(),
  unique(poll_id, voter_token)
);

-- Q&A
create table public.uwustage_qa (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  question text not null,
  author_name text null,
  upvotes integer default 0,
  downvotes integer default 0,
  is_answered boolean default false,
  is_pinned boolean default false,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- Q&A VOTES
create table public.uwustage_qa_votes (
  id uuid default gen_random_uuid() primary key,
  qa_id uuid not null references uwustage_qa(id) on delete cascade,
  voter_token text not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz default now(),
  unique(qa_id, voter_token)
);

-- QUIZ QUESTIONS
create table public.uwustage_quiz (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]', -- [{id: string, text: string}]
  correct_option_id text not null,
  points integer default 10,
  time_limit_seconds integer default 30,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- QUIZ ANSWERS
create table public.uwustage_quiz_answers (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid not null references uwustage_quiz(id) on delete cascade,
  player_token text not null,
  player_name text null,
  chosen_option_id text not null,
  is_correct boolean not null,
  answered_at timestamptz default now(),
  unique(quiz_id, player_token)
);

-- SURVEYS
create table public.uwustage_surveys (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]', -- [{id, type: 'text'|'choice'|'rating', text, options?}]
  is_active boolean default true,
  created_at timestamptz default now()
);

-- SURVEY RESPONSES
create table public.uwustage_survey_responses (
  id uuid default gen_random_uuid() primary key,
  survey_id uuid not null references uwustage_surveys(id) on delete cascade,
  responder_token text not null,
  answers jsonb not null default '{}', -- {question_id: answer_value}
  submitted_at timestamptz default now(),
  unique(survey_id, responder_token)
);

-- WORD CLOUD
create table public.uwustage_wordcloud (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  word text not null,
  submitter_token text not null,
  created_at timestamptz default now()
);

-- REACTIONS
create table public.uwustage_reactions (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  reaction_type text not null, -- 'heart' | 'fire' | 'clap' | 'wow' | 'laugh'
  reactor_token text not null,
  created_at timestamptz default now()
);

-- CHAT
create table public.uwustage_chat (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  author_name text not null default 'Anonymous',
  message text not null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- COMMENTS
create table public.uwustage_comments (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid not null references uwustage_stages(id) on delete cascade,
  author_name text null,
  content text not null,
  upvotes integer default 0,
  downvotes integer default 0,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- COMMENT VOTES
create table public.uwustage_comment_votes (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid not null references uwustage_comments(id) on delete cascade,
  voter_token text not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz default now(),
  unique(comment_id, voter_token)
);

-- =============================================================
-- Row Level Security (RLS) — optional but recommended
-- Run these if you want to lock down direct table access.
-- Our serverless functions use the SERVICE key which bypasses RLS.
-- =============================================================

-- alter table public.uwustage_stages enable row level security;
-- alter table public.uwustage_polls enable row level security;
-- ... (repeat for all tables)
-- Then create policies as needed for Supabase Realtime subscriptions.

-- =============================================================
-- Realtime — enable for live audience updates
-- Run in Supabase Dashboard → Database → Replication,
-- or execute:
-- =============================================================

-- alter publication supabase_realtime add table uwustage_chat;
-- alter publication supabase_realtime add table uwustage_reactions;
-- alter publication supabase_realtime add table uwustage_qa;
-- alter publication supabase_realtime add table uwustage_wordcloud;
-- alter publication supabase_realtime add table uwustage_polls;
-- alter publication supabase_realtime add table uwustage_poll_votes;
-- alter publication supabase_realtime add table uwustage_comments;
-- alter publication supabase_realtime add table uwustage_quiz;
-- alter publication supabase_realtime add table uwustage_quiz_answers;