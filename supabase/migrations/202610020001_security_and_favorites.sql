-- Apply in the Supabase SQL editor before enabling the new verification flows.
begin;
create table if not exists public.identity_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cedula text not null check (length(trim(cedula)) between 1 and 30),
  front_path text not null,
  back_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now()
);
alter table public.identity_verifications enable row level security;
create policy "Read own identity submission" on public.identity_verifications for select to authenticated using (user_id = auth.uid());
create policy "Submit own identity" on public.identity_verifications for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and front_path like auth.uid()::text || '/%' and back_path like auth.uid()::text || '/%');
create policy "Resubmit rejected identity" on public.identity_verifications for update to authenticated using (user_id = auth.uid() and status = 'rejected') with check (user_id = auth.uid() and status = 'pending' and front_path like auth.uid()::text || '/%' and back_path like auth.uid()::text || '/%');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-documents', 'identity-documents', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "Upload private identity photos" on storage.objects for insert to authenticated with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Remove unsubmitted identity photos" on storage.objects for delete to authenticated using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text and not exists (select 1 from public.identity_verifications v where v.user_id = auth.uid() and (v.front_path = name or v.back_path = name)));
create policy "Read own identity photos" on storage.objects for select to authenticated using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (user_id, product_id)
);
-- Remove legacy duplicates before enforcing one like per user/product.
delete from public.favorites a using public.favorites b where a.user_id = b.user_id and a.product_id = b.product_id and a.ctid < b.ctid;
create unique index if not exists favorites_user_product_unique on public.favorites(user_id, product_id);
alter table public.favorites enable row level security;
create policy "Read own favorites" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "Add own favorites" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "Remove own favorites" on public.favorites for delete to authenticated using (user_id = auth.uid());

create or replace function public.mark_product_sold(target_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare item public.products%rowtype;
begin
  select * into item from public.products where id = target_id for update;
  if not found or item.seller_id <> auth.uid() or auth.uid() is null then raise exception 'No tienes permiso para modificar este artículo.'; end if;
  if item.status <> 'active' then raise exception 'El artículo ya no está disponible.'; end if;
  if exists (select 1 from public.orders where product_id = target_id and status not in ('cancelled', 'refunded')) then raise exception 'Este artículo tiene un pedido. Gestiona su venta desde Ventas.'; end if;
  update public.products set status = 'sold' where id = target_id;
end;
$$;
revoke all on function public.mark_product_sold(uuid) from public, anon;
grant execute on function public.mark_product_sold(uuid) to authenticated;
commit;
