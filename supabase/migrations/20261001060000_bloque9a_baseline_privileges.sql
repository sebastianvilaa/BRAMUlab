-- BRAMUlab — Bloque 9A (replay limpio): línea base de privilegios INDEPENDIENTE de las ACL por defecto del proyecto.
--
-- Hallazgo del replay desde base vacía: el estado final de privilegios de tablas/funciones de `public` dependía de las ACL
-- por defecto que traiga el proyecto Supabase (Staging las tiene de una forma; un proyecto Production nuevo puede traer
-- otra, p. ej. conceder todo a anon/authenticated a toda tabla/función nueva). Las migraciones históricas solo revocan
-- tablas puntuales y `FROM PUBLIC` en funciones; con defaults "abiertos" quedarían DML/TRUNCATE y EXECUTE concedidos a
-- anon/authenticated por detrás de RLS. Esta migración fija el estado final de forma idempotente y NO cambia el
-- comportamiento de producto: el cliente jamás escribe tablas de `public` directamente (todo pasa por RPC/Edge) y solo
-- lee (con RLS) app_config, legal_versions, profiles, level_states y locations.
--
--   * tablas: sin INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER para anon/authenticated; anon sin SELECT salvo las
--     dos lecturas públicas deliberadas (app_config, legal_versions). authenticated conserva SELECT (limitado por RLS).
--   * funciones: anon sin EXECUTE salvo is_username_available (decisión de producto de Bloque 3); authenticated SOLO
--     con las RPC de cliente conocidas (lista explícita de abajo, derivada del replay limpio: 58 funciones). Bajo defaults
--     "abiertos" las RPC administrativas/internas (admin_*, consume_rate_limit, _groups_*, _bloque6/7_*) quedarían
--     ejecutables por cualquier usuario autenticado.
--   * default privileges: las tablas/funciones FUTURAS no heredan esos privilegios (una tabla nueva que el cliente deba
--     leer necesita un GRANT SELECT explícito en su propia migración — es el contrato ya documentado "GRANT + RLS").
-- service_role no se toca.

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke select on all tables in schema public from anon;
grant select on table public.app_config, public.legal_versions to anon;

revoke execute on all functions in schema public from anon;
grant execute on function public.is_username_available(text) to anon;

alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke select on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- authenticated: se retira todo EXECUTE explícito y se re-concede únicamente la superficie RPC/RLS que el cliente usa.
-- (Los EXECUTE heredados de PUBLIC no se tocan: ninguna SECURITY DEFINER los conserva, ver audit-live-grants.sql.)
-- Atómico dentro de la migración. Toda RPC futura debe traer su propio GRANT EXECUTE ... TO authenticated.
revoke execute on all functions in schema public from authenticated;
alter default privileges in schema public revoke execute on functions from authenticated;

grant execute on function public._group_photo_can_cleanup(text) to authenticated;
grant execute on function public._group_photo_can_delete(text) to authenticated;
grant execute on function public._group_photo_can_read(text) to authenticated;
grant execute on function public._group_photo_can_write(text) to authenticated;
grant execute on function public._group_photo_folder_group_id(text) to authenticated;
grant execute on function public.accept_legal_version(text) to authenticated;
grant execute on function public.add_group_member(uuid,uuid) to authenticated;
grant execute on function public.claim_provisional_player(text) to authenticated;
grant execute on function public.complete_contact_profile_data(text,boolean) to authenticated;
grant execute on function public.complete_profile(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.complete_ranking_profile_data(text,boolean,text,text,text,text,text) to authenticated;
grant execute on function public.create_claim_link(uuid) to authenticated;
grant execute on function public.create_group(text,uuid[]) to authenticated;
grant execute on function public.create_provisional_player(text) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.demote_group_admin(uuid,uuid) to authenticated;
grant execute on function public.get_current_ranking_edition() to authenticated;
grant execute on function public.get_group_competition_data(uuid,timestamp with time zone,timestamp with time zone) to authenticated;
grant execute on function public.get_group_detail(uuid) to authenticated;
grant execute on function public.get_groups_lobby(timestamp with time zone,timestamp with time zone) to authenticated;
grant execute on function public.get_home_ranking_insight() to authenticated;
grant execute on function public.get_match_detail(uuid) to authenticated;
grant execute on function public.get_my_last_level_delta() to authenticated;
grant execute on function public.get_my_legal_status() to authenticated;
grant execute on function public.get_my_matches(integer,boolean) to authenticated;
grant execute on function public.get_my_ranking_position(text,integer) to authenticated;
grant execute on function public.get_notifications(integer,boolean) to authenticated;
grant execute on function public.get_pending_action_count() to authenticated;
grant execute on function public.get_player_intelligence_history(integer,timestamp with time zone,boolean) to authenticated;
grant execute on function public.get_players_compact(uuid[]) to authenticated;
grant execute on function public.get_profile_ranking_summary(uuid) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_ranking_classification(text,text,integer,text,integer,integer) to authenticated;
grant execute on function public.get_ranking_network(text) to authenticated;
grant execute on function public.get_whatsapp_contact(uuid) to authenticated;
grant execute on function public.hide_match_for_me(uuid,boolean) to authenticated;
grant execute on function public.is_player_saved(uuid) to authenticated;
grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.list_my_provisional_players() to authenticated;
grant execute on function public.list_related_provisional_players() to authenticated;
grant execute on function public.list_saved_players() to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.promote_group_admin(uuid,uuid) to authenticated;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
grant execute on function public.remove_saved_player(uuid) to authenticated;
grant execute on function public.rename_group(uuid,text) to authenticated;
grant execute on function public.report_identity_issue(uuid,text,smallint,text) to authenticated;
grant execute on function public.save_player(uuid) to authenticated;
grant execute on function public.search_players(text,integer) to authenticated;
grant execute on function public.set_match_private_note(uuid,text) to authenticated;
grant execute on function public.set_ranking_network_hidden(uuid,boolean) to authenticated;
grant execute on function public.sustain_match_revision(uuid,integer) to authenticated;
grant execute on function public.update_current_category(text) to authenticated;
grant execute on function public.update_group_photo(uuid,text) to authenticated;
grant execute on function public.update_profile_avatar(text) to authenticated;
