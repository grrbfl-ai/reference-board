-- 썸네일 보드 · 후킹 문구 공간 추가
-- Supabase SQL Editor에 전체 붙여넣고 Run (여러 번 실행해도 괜찮음)

-- 썸네일 보드: 사진 + 메모
create table if not exists public.thumbs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  image_path  text not null,
  memo        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists thumbs_user_created_idx on public.thumbs (user_id, created_at desc);
grant select, insert, update, delete on public.thumbs to authenticated;
alter table public.thumbs enable row level security;
drop policy if exists "thumbs_select_own" on public.thumbs;
drop policy if exists "thumbs_insert_own" on public.thumbs;
drop policy if exists "thumbs_update_own" on public.thumbs;
drop policy if exists "thumbs_delete_own" on public.thumbs;
create policy "thumbs_select_own" on public.thumbs for select to authenticated using (auth.uid() = user_id);
create policy "thumbs_insert_own" on public.thumbs for insert to authenticated with check (auth.uid() = user_id);
create policy "thumbs_update_own" on public.thumbs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "thumbs_delete_own" on public.thumbs for delete to authenticated using (auth.uid() = user_id);

-- 후킹 문구: 문구 + 출처 + 내 생각 + 응용 아이디어
create table if not exists public.hooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null,
  category    text not null default '',
  source      text not null default '',
  note        text not null default '',
  idea        text not null default '',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.hooks add column if not exists category text not null default '';
create index if not exists hooks_user_created_idx on public.hooks (user_id, created_at desc);
grant select, insert, update, delete on public.hooks to authenticated;
alter table public.hooks enable row level security;
drop policy if exists "hooks_select_own" on public.hooks;
drop policy if exists "hooks_insert_own" on public.hooks;
drop policy if exists "hooks_update_own" on public.hooks;
drop policy if exists "hooks_delete_own" on public.hooks;
create policy "hooks_select_own" on public.hooks for select to authenticated using (auth.uid() = user_id);
create policy "hooks_insert_own" on public.hooks for insert to authenticated with check (auth.uid() = user_id);
create policy "hooks_update_own" on public.hooks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hooks_delete_own" on public.hooks for delete to authenticated using (auth.uid() = user_id);
