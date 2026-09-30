-- Run on the linked project as postgres; fixtures and approval changes roll back.
begin;
select set_config('test.user_id',gen_random_uuid()::text,true);
select set_config('test.master_id',(select id::text from auth.users where raw_app_meta_data->>'role'='master_admin' limit 1),true);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(current_setting('test.user_id')::uuid,'approval-fixture@example.test','{"provider":"google","providers":["google"]}','{"role":"master_admin"}');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if public.platform_access_status()->>'status'<>'pending' or private.is_master() then raise exception 'New/forged Google account was not pending'; end if;
 begin perform public.platform_set_access(current_setting('test.user_id')::uuid,'active'); raise exception 'Self approval allowed'; exception when insufficient_privilege then null; end;
 begin perform public.platform_list_access(); raise exception 'Client could list customers'; exception when insufficient_privilege then null; end;
 begin update private.platform_access set status='active'; raise exception 'Direct approval allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.embarcacoes(user_id,numero_embarcacao,nome_embarcacao) values(auth.uid(),'approval-fixture','Fixture'); raise exception 'Pending data insertion allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.master_id'),'role','authenticated')::text,true);
set local role authenticated;
select public.platform_set_access(current_setting('test.user_id')::uuid,'active');
do $$ begin
 begin perform public.platform_set_access(auth.uid(),'suspended'); raise exception 'Master suspension allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin if not private.has_access() then raise exception 'Approval did not grant access'; end if; end; $$;
insert into public.embarcacoes(user_id,numero_embarcacao,nome_embarcacao) values(auth.uid(),'approval-fixture','Fixture');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.master_id'),'role','authenticated')::text,true);
set local role authenticated;
select public.platform_set_access(current_setting('test.user_id')::uuid,'suspended');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if private.has_access() or public.platform_access_status()->>'status'<>'suspended' then raise exception 'Suspended client retained permission'; end if;
 if exists(select 1 from public.embarcacoes where user_id=auth.uid()) then raise exception 'Suspended client could read data'; end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from private.access_audit where user_id=current_setting('test.user_id')::uuid)<>2 then raise exception 'Audit missing'; end if;
 if has_function_privilege('anon','public.platform_set_access(uuid,text)','EXECUTE') then raise exception 'Anon may approve'; end if;
end; $$;
rollback;
select 'PASS: trigger pending, forged role rejection, self-approval/list/direct-write rejection, RLS approval and suspension, master protection, audit and anonymous denial' as result;
