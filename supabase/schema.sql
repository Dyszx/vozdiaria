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
  category_id uuid references categories(id) on delete set null,
  category_name text,
  category_color text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

-- Se a tabela tasks já existia antes das categorias serem adicionadas, rode isto também:
-- alter table tasks add column if not exists category_id uuid references categories(id) on delete set null;
-- alter table tasks add column if not exists category_name text;
-- alter table tasks add column if not exists category_color text;

-- Se a tabela tasks já existia antes da lixeira ser adicionada, rode isto também:
-- alter table tasks add column if not exists deleted_at timestamptz;

create index if not exists tasks_user_id_done_idx on tasks (user_id, done, due_date);
create index if not exists tasks_user_id_category_id_idx on tasks (user_id, category_id);
create index if not exists tasks_deleted_at_idx on tasks (user_id, deleted_at);

alter table tasks enable row level security;

create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Perfis com aprovação manual — toda conta nova nasce com approved=false e só
-- um admin (dentro do app, na aba Admin) pode liberar o acesso.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- security definer evita a policy de admin entrar em recursão contra a
-- própria tabela profiles ao checar is_admin.
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "Admins can read all profiles"
  on profiles for select
  using (is_admin());

create policy "Admins can update any profile"
  on profiles for update
  using (is_admin())
  with check (is_admin());

-- Recusar um cadastro pendente apaga a linha em profiles (não a conta em
-- auth.users) — a pessoa fica permanentemente sem perfil, então o app trata
-- como "não aprovado" pra sempre, sem precisar de acesso admin ao Auth.
create policy "Admins can delete any profile"
  on profiles for delete
  using (is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Passo manual (uma vez só): depois de rodar o SQL acima, ache seu UID com
--   select id, email, is_anonymous from auth.users order by created_at desc;
-- e então rode (o gatilho não roda retroativamente pra contas que já existiam):
--   insert into profiles (id, email, approved, is_admin)
--   values ('SEU-UID-AQUI', 'seu@email.com', true, true)
--   on conflict (id) do update set approved = true, is_admin = true;
