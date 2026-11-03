-- 스크립트·응용 아이디어 칸 추가 (SQL Editor에서 실행, 여러 번 실행해도 괜찮음)
alter table public.refs add column if not exists script text not null default '';
alter table public.refs add column if not exists idea   text not null default '';
