-- Run this in the Supabase SQL editor

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Documents table (one row per uploaded PDF)
create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    filename text not null,
    storage_path text not null,
    page_count int default 0,
    status text default 'ready' check (status in ('processing', 'ready', 'failed')),
    error_message text,
    summary text,
    created_at timestamptz default now()
);

-- 3. Chunks table (one row per text chunk, with its embedding)
-- jina-embeddings-v3 outputs 1024-dim vectors
create table if not exists chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    content text not null,
    chunk_index int not null,
    page_number int,
    embedding vector(1024),
    created_at timestamptz default now()
);

-- 4. Index for fast similarity search (cosine distance)
create index if not exists chunks_embedding_idx
    on chunks using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- 5. RPC function for similarity search, filtered by document
create or replace function match_chunks (
    query_embedding vector(1024),
    match_document_id uuid,
    match_count int default 5
)
returns table (
    id uuid,
    content text,
    chunk_index int,
    page_number int,
    similarity float
)
language sql stable
as $$
    select
        chunks.id,
        chunks.content,
        chunks.chunk_index,
        chunks.page_number,
        1 - (chunks.embedding <=> query_embedding) as similarity
    from chunks
    where chunks.document_id = match_document_id
    order by chunks.embedding <=> query_embedding
    limit match_count;
$$;

-- 5b. RPC function for similarity search across MULTIPLE documents at once
-- (used for "ask across all my PDFs" mode)
create or replace function match_chunks_multi (
    query_embedding vector(1024),
    match_document_ids uuid[],
    match_count int default 8
)
returns table (
    id uuid,
    document_id uuid,
    content text,
    chunk_index int,
    page_number int,
    similarity float
)
language sql stable
as $$
    select
        chunks.id,
        chunks.document_id,
        chunks.content,
        chunks.chunk_index,
        chunks.page_number,
        1 - (chunks.embedding <=> query_embedding) as similarity
    from chunks
    where chunks.document_id = any(match_document_ids)
    order by chunks.embedding <=> query_embedding
    limit match_count;
$$;

-- 5c. Daily usage tracking, for simple per-user rate limiting (uploads/questions per day)
create table if not exists usage_daily (
    user_id uuid references auth.users(id) on delete cascade,
    usage_date date not null default current_date,
    upload_count int not null default 0,
    question_count int not null default 0,
    primary key (user_id, usage_date)
);

alter table usage_daily enable row level security;

drop policy if exists "Users can see their own usage" on usage_daily;
create policy "Users can see their own usage"
    on usage_daily for select
    using (auth.uid() = user_id);

-- RPC to atomically increment a counter and return the new value
-- kind must be 'upload_count' or 'question_count'
create or replace function increment_usage (
    p_user_id uuid,
    p_kind text
)
returns int
language plpgsql
as $$
declare
    new_value int;
begin
    insert into usage_daily (user_id, usage_date)
    values (p_user_id, current_date)
    on conflict (user_id, usage_date) do nothing;

    if p_kind = 'upload_count' then
        update usage_daily set upload_count = upload_count + 1
        where user_id = p_user_id and usage_date = current_date
        returning upload_count into new_value;
    else
        update usage_daily set question_count = question_count + 1
        where user_id = p_user_id and usage_date = current_date
        returning question_count into new_value;
    end if;

    return new_value;
end;
$$;


create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    is_web_answer boolean default false,
    sources jsonb,
    created_at timestamptz default now()
);

create index if not exists messages_document_idx on messages (document_id, created_at);

-- 7. Row Level Security
alter table documents enable row level security;
alter table chunks enable row level security;
alter table messages enable row level security;

drop policy if exists "Users can manage their own documents" on documents;
create policy "Users can manage their own documents"
    on documents for all
    using (auth.uid() = user_id);

drop policy if exists "Users can access chunks of their own documents" on chunks;
create policy "Users can access chunks of their own documents"
    on chunks for all
    using (
        exists (
            select 1 from documents
            where documents.id = chunks.document_id
            and documents.user_id = auth.uid()
        )
    );

drop policy if exists "Users can access their own messages" on messages;
create policy "Users can access their own messages"
    on messages for all
    using (auth.uid() = user_id);

-- 8. Storage bucket for raw PDFs (run once)
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;
