create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.platform_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 changed_by uuid references auth.users(id) on delete set null
);
alter table private.platform_access enable row level security;
revoke all on private.platform_access from public, anon, authenticated;
create table private.access_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null, status text not null, changed_by uuid not null, changed_at timestamptz not null default now()
);
alter table private.access_audit enable row level security;
revoke all on private.access_audit from public, anon, authenticated;
create function private.is_master() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='master_admin');
$$;
create function private.has_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_master() or exists(select 1 from private.platform_access where user_id=(select auth.uid()) and status='active'));
$$;
create function private.new_platform_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.platform_access(user_id,status) values(new.id,case when new.raw_app_meta_data->>'role'='master_admin' then 'active' else 'pending' end);
 return new;
end; $$;
revoke all on function private.new_platform_user() from public,anon,authenticated;
create trigger platform_user_created after insert on auth.users for each row execute function private.new_platform_user();
insert into private.platform_access(user_id,status) select id,case when raw_app_meta_data->>'role'='master_admin' then 'active' else 'pending' end from auth.users;
create function private.access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',case when private.is_master() then 'active' else coalesce((select status from private.platform_access where user_id=auth.uid()),'pending') end,'is_master',private.is_master());
$$;
create function private.list_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_master() then raise exception 'Master access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(row_to_json(u)) from (select a.user_id,u.email,coalesce(u.raw_user_meta_data->>'full_name','') as name,case when u.raw_app_meta_data->>'role'='master_admin' then 'active' else a.status end as status,coalesce(u.raw_app_meta_data->>'role'='master_admin',false) as is_master,a.created_at,a.updated_at from private.platform_access a join auth.users u on u.id=a.user_id order by a.created_at desc) u),'[]'::jsonb);
end; $$;
create function private.set_access(target_user uuid,new_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_master() then raise exception 'Master access required' using errcode='42501'; end if;
 if new_status not in ('active','suspended','pending') or new_status is null then raise exception 'Invalid status' using errcode='22023'; end if;
 if exists(select 1 from auth.users where id=target_user and raw_app_meta_data->>'role'='master_admin') then raise exception 'Master account is protected' using errcode='42501'; end if;
 update private.platform_access set status=new_status,updated_at=now(),changed_by=auth.uid() where user_id=target_user;
 if not found then raise exception 'Account not found' using errcode='22023'; end if;
 insert into private.access_audit(user_id,status,changed_by) values(target_user,new_status,auth.uid());
end; $$;
revoke all on function private.is_master(),private.has_access(),private.access_status(),private.list_access(),private.set_access(uuid,text) from public,anon;
grant execute on function private.is_master(),private.has_access(),private.access_status(),private.list_access(),private.set_access(uuid,text) to authenticated;
create function public.platform_access_status() returns jsonb language sql stable security invoker set search_path='' as $$ select private.access_status(); $$;
create function public.platform_list_access() returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_access(); $$;
create function public.platform_set_access(target_user uuid,new_status text) returns void language sql security invoker set search_path='' as $$ select private.set_access(target_user,new_status); $$;
revoke all on function public.platform_access_status(),public.platform_list_access(),public.platform_set_access(uuid,text) from public,anon;
grant execute on function public.platform_access_status(),public.platform_list_access(),public.platform_set_access(uuid,text) to authenticated;
create policy approved_access on public.embarcacoes as restrictive for all to authenticated using ((select private.has_access())) with check ((select private.has_access()));
create policy approved_access on public.rotas as restrictive for all to authenticated using ((select private.has_access())) with check ((select private.has_access()));
create policy approved_access on public.historico_navegacao as restrictive for all to authenticated using ((select private.has_access())) with check ((select private.has_access()));
create policy approved_access on public.pontos_salvos as restrictive for all to authenticated using ((select private.has_access())) with check ((select private.has_access()));
