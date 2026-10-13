begin;

create table public.direct_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id),
  conversation_id uuid not null references public.conversations(id),
  seller_id uuid not null references public.profiles(id),
  buyer_id uuid not null references public.profiles(id),
  product_title text not null,
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  payment_received_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
alter table public.direct_sales enable row level security;
revoke all on public.direct_sales from anon, authenticated;
grant select on public.direct_sales to authenticated;
create policy "Participants read direct sales" on public.direct_sales for select to authenticated
  using (auth.uid() = seller_id or auth.uid() = buyer_id);

create function public.confirm_direct_payment(target_product uuid, target_conversation uuid, agreed_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  item public.products%rowtype;
  chat public.conversations%rowtype;
  buyer uuid;
  sale_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para continuar.'; end if;
  if agreed_amount is null or agreed_amount <= 0 or agreed_amount > 1000000 or agreed_amount <> round(agreed_amount, 2) then
    raise exception 'Ingresa un importe válido con hasta dos decimales.';
  end if;
  select * into item from public.products where id = target_product for update;
  if not found or item.seller_id <> auth.uid() then raise exception 'Solo el vendedor puede confirmar el pago.'; end if;
  select * into chat from public.conversations where id = target_conversation;
  if not found or auth.uid() not in (chat.user_one_id, chat.user_two_id) then raise exception 'Conversación inválida.'; end if;
  buyer := case when chat.user_one_id = auth.uid() then chat.user_two_id else chat.user_one_id end;
  if buyer is null or buyer = auth.uid() then raise exception 'Comprador inválido.'; end if;
  -- Retries succeed only for the same sale and amount; a second buyer cannot win.
  select id into sale_id from public.direct_sales where product_id = item.id and conversation_id = chat.id and amount = agreed_amount;
  if sale_id is not null then return sale_id; end if;
  if item.status <> 'active' then raise exception 'El artículo ya no está disponible.'; end if;
  if exists (select 1 from public.orders where product_id = item.id and status not in ('pending_payment', 'cancelled', 'refunded')) then
    raise exception 'Este artículo tiene un pedido anterior que debe resolverse primero.';
  end if;
  insert into public.direct_sales(product_id, conversation_id, seller_id, buyer_id, product_title, amount)
    values (item.id, chat.id, auth.uid(), buyer, item.title, agreed_amount) returning id into sale_id;
  update public.products set status = 'sold' where id = item.id;
  return sale_id;
end;
$$;
revoke all on function public.confirm_direct_payment(uuid, uuid, numeric) from public, anon;
grant execute on function public.confirm_direct_payment(uuid, uuid, numeric) to authenticated;
commit;
