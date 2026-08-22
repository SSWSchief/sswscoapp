-- Web Push subscription storage for OS-level notifications. Kept generic (no
-- event-type column) so future event types can reuse these rows without a
-- new table. Not added to the supabase_realtime publication: nothing needs
-- to subscribe to changes on this table, it is only read by server routes.
create table public.push_subscriptions(id text primary key default gen_random_uuid()::text,user_id text not null references public.users(id) on delete cascade,endpoint text not null unique,p256dh text not null,auth text not null,user_agent text not null default '',created_at timestamptz not null default now(),last_seen_at timestamptz not null default now());
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated using(user_id=public.current_app_user_id()) with check(user_id=public.current_app_user_id());
