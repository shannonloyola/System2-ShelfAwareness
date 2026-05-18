-- Domain 2 / Supply Chain Procurement
-- Purpose: allow procurement-service Supabase REST reads for current monthly budget.
-- This does not insert, update, delete, or alter products.

grant select on table public.monthly_budgets to anon, authenticated;

alter table public.monthly_budgets enable row level security;

drop policy if exists "Allow procurement service read monthly budgets" on public.monthly_budgets;

create policy "Allow procurement service read monthly budgets"
on public.monthly_budgets
for select
to anon, authenticated
using (true);

-- Verification: should return your May 2026 row when run in SQL Editor.
select budget_id, month, year, allocated_amount, spent_amount, created_at
from public.monthly_budgets
where month = 5
  and year = 2026;

