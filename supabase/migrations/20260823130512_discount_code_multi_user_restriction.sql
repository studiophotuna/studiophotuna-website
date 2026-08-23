-- Replace single restricted_user_id with a join table supporting any
-- number of restricted users (zero rows = open to everyone). No live
-- discount code used restricted_user_id yet, so this is a clean swap.
alter table public.discount_codes drop column restricted_user_id;

create table public.discount_code_restricted_users (
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (discount_code_id, user_id)
);

alter table public.discount_code_restricted_users enable row level security;

create policy "admin_read_write_restricted_users" on public.discount_code_restricted_users
  for all to authenticated using (is_admin()) with check (is_admin());
