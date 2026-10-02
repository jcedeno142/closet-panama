alter table public.profiles
  add column if not exists theme text not null default 'light'
  check (theme in ('light', 'black'));
