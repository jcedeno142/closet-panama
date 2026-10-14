begin;
alter table public.direct_sales
  add column delivery_status text not null default 'pending' check (delivery_status in ('pending', 'not_received', 'received')),
  add column delivery_report text check (length(delivery_report) <= 1000),
  add column not_received_at timestamptz,
  add column received_at timestamptz;

create table public.direct_sale_reviews (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.direct_sales(id),
  reviewer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000),
  delivery_status text not null check (delivery_status in ('not_received', 'received')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.direct_sale_reviews enable row level security;
revoke all on public.direct_sale_reviews from anon, authenticated;
grant select on public.direct_sale_reviews to anon, authenticated;
create policy "Public buyer reviews" on public.direct_sale_reviews for select using (true);

create function public.set_direct_delivery(target_sale uuid, new_status text, expected_status text, report_details text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare sale public.direct_sales%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para continuar.'; end if;
  select * into sale from public.direct_sales where id = target_sale for update;
  if not found or sale.buyer_id <> auth.uid() then raise exception 'Solo el comprador de esta venta puede actualizar la entrega.'; end if;
  if new_status is null or new_status not in ('not_received', 'received') then raise exception 'Estado inválido.'; end if;
  if length(coalesce(report_details, '')) > 1000 then raise exception 'El detalle no puede superar 1000 caracteres.'; end if;
  if sale.delivery_status <> new_status then
    if expected_status is null or sale.delivery_status <> expected_status then raise exception 'El estado cambió. Actualiza la página e inténtalo nuevamente.'; end if;
    update public.direct_sales set
      delivery_status = new_status,
      delivery_report = case when new_status = 'not_received' then trim(coalesce(report_details, '')) else delivery_report end,
      not_received_at = case when new_status = 'not_received' then now() else not_received_at end,
      received_at = case when new_status = 'received' then now() else null end
      where id = sale.id returning * into sale;
  end if;
  return jsonb_build_object('delivery_status', sale.delivery_status, 'delivery_report', sale.delivery_report, 'not_received_at', sale.not_received_at, 'received_at', sale.received_at);
end;
$$;

create function public.review_direct_sale(target_sale uuid, stars integer, review_comment text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare sale public.direct_sales%rowtype; result public.direct_sale_reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para continuar.'; end if;
  select * into sale from public.direct_sales where id = target_sale for update;
  if not found or sale.buyer_id <> auth.uid() then raise exception 'Solo el comprador de esta venta puede calificar.'; end if;
  if sale.delivery_status not in ('not_received', 'received') then raise exception 'Primero indica si recibiste el artículo.'; end if;
  if stars is null or stars not between 1 and 5 then raise exception 'Selecciona entre 1 y 5 estrellas.'; end if;
  if length(coalesce(review_comment, '')) > 1000 then raise exception 'La opinión no puede superar 1000 caracteres.'; end if;
  insert into public.direct_sale_reviews(sale_id, reviewer_id, seller_id, rating, comment, delivery_status)
    values(sale.id, auth.uid(), sale.seller_id, stars, trim(coalesce(review_comment, '')), sale.delivery_status)
    on conflict (sale_id) do update set rating = excluded.rating, comment = excluded.comment,
      delivery_status = excluded.delivery_status, updated_at = now()
    returning * into result;
  return jsonb_build_object('rating', result.rating, 'comment', result.comment);
end;
$$;
revoke all on function public.set_direct_delivery(uuid, text, text, text) from public, anon;
revoke all on function public.review_direct_sale(uuid, integer, text) from public, anon;
grant execute on function public.set_direct_delivery(uuid, text, text, text) to authenticated;
grant execute on function public.review_direct_sale(uuid, integer, text) to authenticated;
commit;
