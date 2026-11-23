-- =====================================================================
-- راشن · Ration — Supabase setup
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Safe to run again.
-- =====================================================================

-- Offers shown to every user
create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  store      text not null,
  name       text not null,
  brand      text,
  size       text,
  price      numeric(10,2) not null check (price > 0),
  old_price  numeric(10,2),
  until      date,
  source     text not null default 'flyer',
  created_at timestamptz not null default now()
);

-- Each user's saved shopping list
create table if not exists public.lists (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Who may add or delete offers (by login email)
create table if not exists public.admins (
  email text primary key
);
insert into public.admins (email) values ('h.gharib89@gmail.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Row Level Security
alter table public.offers enable row level security;
alter table public.lists  enable row level security;
alter table public.admins enable row level security;   -- no policies: only is_admin() reads it

drop policy if exists "offers: everyone reads"  on public.offers;
drop policy if exists "offers: admins insert"   on public.offers;
drop policy if exists "offers: admins update"   on public.offers;
drop policy if exists "offers: admins delete"   on public.offers;
create policy "offers: everyone reads" on public.offers for select to anon, authenticated using (true);
create policy "offers: admins insert"  on public.offers for insert to authenticated with check (public.is_admin());
create policy "offers: admins update"  on public.offers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "offers: admins delete"  on public.offers for delete to authenticated using (public.is_admin());

drop policy if exists "lists: own list" on public.lists;
create policy "lists: own list" on public.lists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;
grant select, insert, update, delete on public.lists to authenticated;
revoke all on public.admins from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Demo prices for testing (labelled "demo" in the app; delete them from the app's Offers tab)
insert into public.offers (store, name, brand, size, price, old_price, until, source)
select * from (values
  ('جمعية الشارقة التعاونية', 'حليب طازج كامل الدسم', 'المراعي', '2 لتر', 11.75, 12.5, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'حليب طازج كامل الدسم', 'المراعي', '2 لتر', 11.5, 12.5, date '2026-11-30', 'demo'),
  ('كارفور', 'حليب طازج كامل الدسم', 'المراعي', '2 لتر', 11.25, 12.5, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'حليب طازج كامل الدسم', 'المراعي', '2 لتر', 10.95, 12.5, date '2026-11-30', 'demo'),
  ('نستو', 'حليب طازج كامل الدسم', 'المراعي', '2 لتر', 11.5, 12.5, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'رز بسمتي', 'إنديا جيت', '5 كغ', 39.5, 49.0, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'رز بسمتي', 'إنديا جيت', '5 كغ', 38.75, 49.0, date '2026-11-30', 'demo'),
  ('كارفور', 'رز بسمتي', 'إنديا جيت', '5 كغ', 41.0, 49.0, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'رز بسمتي', 'إنديا جيت', '5 كغ', 40.5, 49.0, date '2026-11-30', 'demo'),
  ('نستو', 'رز بسمتي', 'إنديا جيت', '5 كغ', 37.95, 49.0, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'بيض', 'الجزيرة', '30 حبة', 18.5, 21.0, date '2026-11-30', 'demo'),
  ('كارفور', 'بيض', 'الجزيرة', '30 حبة', 19.0, 21.0, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'بيض', 'الجزيرة', '30 حبة', 18.25, 21.0, date '2026-11-30', 'demo'),
  ('نستو', 'بيض', 'الجزيرة', '30 حبة', 17.5, 21.0, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'زيت دوار الشمس', 'عافية', '1.8 لتر', 16.95, 19.5, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'زيت دوار الشمس', 'عافية', '1.8 لتر', 17.5, 19.5, date '2026-11-30', 'demo'),
  ('كارفور', 'زيت دوار الشمس', 'عافية', '1.8 لتر', 15.95, 19.5, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'زيت دوار الشمس', 'عافية', '1.8 لتر', 16.5, 19.5, date '2026-11-30', 'demo'),
  ('نستو', 'زيت دوار الشمس', 'عافية', '1.8 لتر', 17.25, 19.5, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'دجاج مجمد', 'ساديا', '1 كغ', 13.95, 16.0, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'دجاج مجمد', 'ساديا', '1 كغ', 14.5, 16.0, date '2026-11-30', 'demo'),
  ('كارفور', 'دجاج مجمد', 'ساديا', '1 كغ', 13.5, 16.0, date '2026-11-30', 'demo'),
  ('نستو', 'دجاج مجمد', 'ساديا', '1 كغ', 13.75, 16.0, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'سكر', 'الخليج', '2 كغ', 7.95, 9.0, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'سكر', 'الخليج', '2 كغ', 7.75, 9.0, date '2026-11-30', 'demo'),
  ('كارفور', 'سكر', 'الخليج', '2 كغ', 8.25, 9.0, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'سكر', 'الخليج', '2 كغ', 7.5, 9.0, date '2026-11-30', 'demo'),
  ('نستو', 'سكر', 'الخليج', '2 كغ', 7.95, 9.0, date '2026-11-30', 'demo'),
  ('جمعية الشارقة التعاونية', 'ماء', 'مسافي', '1.5 لتر × 6', 6.95, 8.0, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'ماء', 'مسافي', '1.5 لتر × 6', 6.5, 8.0, date '2026-11-30', 'demo'),
  ('كارفور', 'ماء', 'مسافي', '1.5 لتر × 6', 7.25, 8.0, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'ماء', 'مسافي', '1.5 لتر × 6', 6.75, 8.0, date '2026-11-30', 'demo'),
  ('نستو', 'ماء', 'مسافي', '1.5 لتر × 6', 6.25, 8.0, date '2026-11-30', 'demo'),
  ('تعاونية الاتحاد', 'مسحوق غسيل', 'آريال', '3 كغ', 36.0, 42.0, date '2026-11-30', 'demo'),
  ('كارفور', 'مسحوق غسيل', 'آريال', '3 كغ', 33.5, 42.0, date '2026-11-30', 'demo'),
  ('لولو هايبرماركت', 'مسحوق غسيل', 'آريال', '3 كغ', 35.5, 42.0, date '2026-11-30', 'demo'),
  ('نستو', 'مسحوق غسيل', 'آريال', '3 كغ', 34.0, 42.0, date '2026-11-30', 'demo')
) as v(store, name, brand, size, price, old_price, until, source)
where not exists (select 1 from public.offers where source = 'demo');
