-- VozDiária — Supabase schema
-- Rode este script inteiro no SQL Editor do painel Supabase (Project > SQL Editor > New query)

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  icon text not null,
  user_id uuid not null references auth.users(id) on delete cascade
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  audio_url text not null,
  category_id uuid references categories(id) on delete set null,
  category_name text not null,
  category_color text not null,
  created_at timestamptz not null default now(),
  duration integer not null default 0,
  edited boolean not null default false,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz
);

-- Se a tabela já existia antes da lixeira ser adicionada, rode isto também:
-- alter table entries add column if not exists deleted_at timestamptz;

-- Se a tabela já existia antes de a exclusão de categoria ficar segura, rode isto também
-- (evita que apagar uma categoria apague, em cascata, todas as notas que a usavam):
-- alter table entries alter column category_id drop not null;
-- alter table entries drop constraint entries_category_id_fkey;
-- alter table entries add constraint entries_category_id_fkey
--   foreign key (category_id) references categories(id) on delete set null;

create index if not exists entries_user_id_created_at_idx on entries (user_id, created_at desc);
create index if not exists entries_deleted_at_idx on entries (user_id, deleted_at);
create index if not exists categories_user_id_idx on categories (user_id);

alter table categories enable row level security;
alter table entries enable row level security;

create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own entries"
  on entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for recorded audio
insert into storage.buckets (id, name, public)
values ('audios', 'audios', true)
on conflict (id) do nothing;

create policy "Users manage their own audio files"
  on storage.objects for all
  using (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'audios' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read access to audio files"
  on storage.objects for select
  using (bucket_id = 'audios');

-- Tarefas extraídas automaticamente dos áudios (por IA ou por palavra-chave)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date timestamptz,
  done boolean not null default false,
  source text not null default 'ai', -- 'ai' | 'keyword'
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_id_done_idx on tasks (user_id, done, due_date);

alter table tasks enable row level security;

create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
