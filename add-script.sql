-- 스크립트 칸 추가 (SQL Editor에서 한 번 실행)
alter table public.refs add column if not exists script text not null default '';
