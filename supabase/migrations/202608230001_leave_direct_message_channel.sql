-- Lets a member remove a direct-message conversation from their own message
-- list. Only 'direct' channels are eligible: company channels and the
-- announcements channel are shared, admin-managed spaces, not personal
-- conversations one person can delete out from under everyone else. When the
-- last member leaves, the now-empty channel and its messages are deleted
-- outright (via the existing on-delete-cascade FKs) rather than left orphaned.
create function public.leave_message_channel(target_channel_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.current_app_user_id();
  target_kind text;
  remaining_members int;
begin
  select kind into target_kind from public.message_channels where id = target_channel_id;
  if target_kind is null then
    raise exception 'Channel not found';
  end if;
  if target_kind <> 'direct' then
    raise exception 'Only direct messages can be deleted';
  end if;
  if not exists(
    select 1 from public.message_channel_members m
    where m.channel_id = target_channel_id and m.user_id = actor
  ) then
    raise exception 'Not a member of this conversation';
  end if;

  delete from public.message_channel_members m
    where m.channel_id = target_channel_id and m.user_id = actor;

  select count(*) into remaining_members
    from public.message_channel_members m where m.channel_id = target_channel_id;
  if remaining_members = 0 then
    delete from public.message_channels where id = target_channel_id;
  end if;

  perform public.write_audit('message_channels', target_channel_id, 'leave_direct', null, null, null);
end;
$$;
revoke all on function public.leave_message_channel(text) from public, anon;
grant execute on function public.leave_message_channel(text) to authenticated;
