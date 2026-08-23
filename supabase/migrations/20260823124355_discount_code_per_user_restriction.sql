-- Lets an admin restrict a discount code to one specific user, and tracks
-- per-user redemptions so any code -- restricted or not -- can only be
-- used once by a given user. pending_discount_code_id carries a code
-- through checkout-session creation to the payment-confirmation webhook,
-- where the redemption is actually finalized (never at session creation,
-- so an abandoned checkout doesn't burn a single-use code).

alter table public.discount_codes
  add column restricted_user_id uuid references auth.users(id) on delete set null;

alter table public.licenses
  add column pending_discount_code_id uuid references public.discount_codes(id) on delete set null;

create table public.discount_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (discount_code_id, user_id)
);

alter table public.discount_code_redemptions enable row level security;

create policy "admin_read_write_redemptions" on public.discount_code_redemptions
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "users_read_own_redemptions" on public.discount_code_redemptions
  for select to authenticated using (user_id = auth.uid());
