-- Admins previously had UPDATE-only access to licenses; INSERT was missing,
-- which blocked granting a subscription to a user who has never had a
-- licenses row before (only 6 of 17 profiles had one at the time this was
-- added -- signup only creates a profiles row, not a matching licenses row).
create policy "Admins can insert licenses" on public.licenses
  for insert to authenticated with check (is_admin());
