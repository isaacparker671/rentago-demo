-- Create item reviews for completed rentals.
-- Run in Supabase SQL Editor.

create table if not exists public.item_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, reviewer_id)
);

create index if not exists item_reviews_item_id_idx on public.item_reviews(item_id);
create index if not exists item_reviews_reviewer_id_idx on public.item_reviews(reviewer_id);

alter table public.item_reviews enable row level security;

-- Anyone can read item reviews.
drop policy if exists "item_reviews_select_all" on public.item_reviews;
create policy "item_reviews_select_all"
on public.item_reviews
for select
using (true);

-- A signed-in user can create/update/delete only their own review.
drop policy if exists "item_reviews_insert_own" on public.item_reviews;
create policy "item_reviews_insert_own"
on public.item_reviews
for insert
with check (auth.uid() = reviewer_id);

drop policy if exists "item_reviews_update_own" on public.item_reviews;
create policy "item_reviews_update_own"
on public.item_reviews
for update
using (auth.uid() = reviewer_id)
with check (auth.uid() = reviewer_id);

drop policy if exists "item_reviews_delete_own" on public.item_reviews;
create policy "item_reviews_delete_own"
on public.item_reviews
for delete
using (auth.uid() = reviewer_id);

-- Keep updated_at fresh.
create or replace function public.set_item_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_item_reviews_updated_at on public.item_reviews;
create trigger trg_item_reviews_updated_at
before update on public.item_reviews
for each row execute function public.set_item_reviews_updated_at();
