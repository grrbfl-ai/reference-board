-- 레퍼런스 창고 · Supabase 설정
-- Supabase 왼쪽 메뉴 SQL Editor → New query → 이 내용 전체 붙여넣기 → Run

-- 1) 레퍼런스 테이블
create table if not exists public.refs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url         text not null default '',
  title       text not null,
  category    text not null check (category in ('script','visual','format','thumb','edit')),
  platform    text not null default '기타',
  tags        text[] not null default '{}',
  why         text not null default '',
  script      text not null default '',
  idea        text not null default '',
  image_path  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists refs_user_created_idx on public.refs (user_id, created_at desc);

grant select, insert, update, delete on public.refs to authenticated;

-- 2) 권한: 로그인한 본인 것만 보고, 쓰고, 고치고, 지울 수 있음
alter table public.refs enable row level security;

drop policy if exists "refs_select_own" on public.refs;
drop policy if exists "refs_insert_own" on public.refs;
drop policy if exists "refs_update_own" on public.refs;
drop policy if exists "refs_delete_own" on public.refs;

create policy "refs_select_own" on public.refs for select to authenticated using (auth.uid() = user_id);
create policy "refs_insert_own" on public.refs for insert to authenticated with check (auth.uid() = user_id);
create policy "refs_update_own" on public.refs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "refs_delete_own" on public.refs for delete to authenticated using (auth.uid() = user_id);

-- 3) 캡처 이미지 보관함 (비공개)
insert into storage.buckets (id, name, public)
values ('ref-images', 'ref-images', false)
on conflict (id) do nothing;

drop policy if exists "ref_images_select_own" on storage.objects;
drop policy if exists "ref_images_insert_own" on storage.objects;
drop policy if exists "ref_images_update_own" on storage.objects;
drop policy if exists "ref_images_delete_own" on storage.objects;

create policy "ref_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'ref-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ref_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'ref-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ref_images_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'ref-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ref_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'ref-images' and (storage.foldername(name))[1] = auth.uid()::text);
