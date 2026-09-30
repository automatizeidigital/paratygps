-- Validate revocation on privileged operations rather than relying only on a JWT.
create function private.current_session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id::text=(select auth.jwt()->>'session_id') and s.user_id=(select auth.uid()) and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.current_session_valid() from public,anon;
grant execute on function private.current_session_valid() to authenticated;
create or replace function private.is_master() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_session_valid() and exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='master_admin');
$$;
create or replace function private.has_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.current_session_valid() and (private.is_master() or exists(select 1 from private.platform_access where user_id=(select auth.uid()) and status='active'));
$$;
create or replace function private.access_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.current_session_valid() then raise exception 'Session expired or revoked' using errcode='42501'; end if;
 return jsonb_build_object('status',case when private.is_master() then 'active' else coalesce((select status from private.platform_access where user_id=auth.uid()),'pending') end,'is_master',private.is_master());
end; $$;
create index if not exists platform_access_changed_by_idx on private.platform_access(changed_by);
create index if not exists embarcacoes_user_id_idx on public.embarcacoes(user_id);
create index if not exists rotas_embarcacao_id_idx on public.rotas(embarcacao_id);
create index if not exists historico_navegacao_embarcacao_id_idx on public.historico_navegacao(embarcacao_id);
create index if not exists pontos_salvos_embarcacao_id_idx on public.pontos_salvos(embarcacao_id);
alter policy "users own boats" on public.embarcacoes to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter policy "users own routes" on public.rotas to authenticated using (exists(select 1 from public.embarcacoes e where e.id=rotas.embarcacao_id and e.user_id=(select auth.uid()))) with check (exists(select 1 from public.embarcacoes e where e.id=rotas.embarcacao_id and e.user_id=(select auth.uid())));
alter policy "users own history" on public.historico_navegacao to authenticated using (exists(select 1 from public.embarcacoes e where e.id=historico_navegacao.embarcacao_id and e.user_id=(select auth.uid()))) with check (exists(select 1 from public.embarcacoes e where e.id=historico_navegacao.embarcacao_id and e.user_id=(select auth.uid())));
alter policy "users own points" on public.pontos_salvos to authenticated using (exists(select 1 from public.embarcacoes e where e.id=pontos_salvos.embarcacao_id and e.user_id=(select auth.uid()))) with check (exists(select 1 from public.embarcacoes e where e.id=pontos_salvos.embarcacao_id and e.user_id=(select auth.uid())));
