-- BRAMUlab — Bloque 6: hotfix de get_notifications() sobre Staging ya migrado.
--
-- La migración base de notificaciones ya fue aplicada antes de detectar en PostgreSQL real
-- la ambigüedad PL/pgSQL entre las columnas de RETURNS TABLE y las columnas del subquery.
-- Reaplica únicamente get_notifications() con las referencias externas calificadas.

create or replace function public.get_notifications(p_limit integer default 50, p_only_unread boolean default false)
returns table (
  notification_id uuid,
  type             text,
  match_id         uuid,
  payload          jsonb,
  created_at       timestamptz,
  read_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id from public.players where auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- C-08/C-10 (10_Revision_Final_Pre_Staging_ChatGPT.md): las tareas accionables se DERIVAN en
  -- lectura desde el estado real del partido/revisión/incidencia — nunca se persisten como
  -- mensajes históricos (report_identity_issue/propose_post_validation_correction ya NO insertan
  -- 'identity_questioned'/'correction_proposed'). Así desaparecen automáticamente para AMBOS
  -- integrantes de la pareja apenas se resuelve el estado, sin poder marcarse "leídas"
  -- prematuramente (una tarea sintética nunca tiene una fila real que mark_notification_read
  -- pueda actualizar). La ventana de 3 días de una corrección pendiente (C-10) se evalúa acá
  -- mismo contra validated_at — sin cron, una corrección vencida simplemente deja de aparecer.
  -- notification_id se deriva determinísticamente (md5 formateado como uuid) del tipo+clave real
  -- para que sea estable entre lecturas sucesivas.
  return query
    select all_rows.* from (
      -- 1) pending_review — partido pending_validation, deadline vigente, la acción es del lado
      --    del caller (aparece para AMBOS integrantes de esa pareja, cada uno al consultar).
      select
        (regexp_replace(md5('pending_review:' || m.match_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid as notification_id,
        'pending_review'::text as type,
        m.match_id as match_id,
        '{}'::jsonb as payload,
        m.created_at as created_at,
        null::timestamptz as read_at
      from public.matches m
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp.team

      union all

      -- 2) correction_proposed — corrección post-validación en espera, ventana de 3 días vigente
      --    (C-10: vencida deja de mostrarse, sin necesitar materializar nada), lado del caller es
      --    quien debe responder.
      select
        (regexp_replace(md5('correction_proposed:' || m.pending_correction_revision_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'correction_proposed'::text,
        m.match_id,
        jsonb_build_object('pendingCorrectionRevisionId', m.pending_correction_revision_id, 'proposedByPlayerId', mr.proposed_by_player_id),
        mr.created_at,
        null::timestamptz
      from public.matches m
      join public.match_revisions mr on mr.revision_id = m.pending_correction_revision_id
      join public.match_participants mp on mp.match_id = m.match_id and mp.player_id = v_caller_player_id
      where m.pending_correction_revision_id is not null
        and mp.team <> mr.proposed_by_team
        and m.validated_at is not null
        and now() <= m.validated_at + interval '3 days'

      union all

      -- 3) identity_questioned — incidencia open sobre un partido donde el caller sigue siendo
      --    participante habilitado.
      select
        (regexp_replace(md5('identity_questioned:' || mii.issue_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'identity_questioned'::text,
        mii.match_id,
        jsonb_build_object('issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team),
        mii.opened_at,
        null::timestamptz
      from public.match_identity_issues mii
      join public.match_participants mp on mp.match_id = mii.match_id and mp.player_id = v_caller_player_id
      where mii.status = 'open'

      union all

      -- 4) notificaciones PERSISTIDAS informativas — eventos ya consumados (match_validated,
      --    correction_accepted, identity_resolved/unidentified, admin_action, etc.).
      select n.notification_id, n.type, n.match_id, n.payload, n.created_at, n.read_at
      from public.notifications n
      where n.player_id = v_caller_player_id
    ) all_rows
    where not p_only_unread or all_rows.read_at is null
    order by all_rows.created_at desc
    limit v_limit;
end;
$$;

comment on function public.get_notifications is
  'Bandeja del caller, más reciente primero. Nunca expone notificaciones de otro jugador. Unión
   de tareas accionables DERIVADAS en lectura (pending_review/correction_proposed/
   identity_questioned — C-08/C-10, desaparecen solas al resolverse, nunca marcables como
   leídas) con notificaciones persistidas informativas (eventos ya ocurridos).';

revoke all on function public.get_notifications(integer, boolean) from public;
grant execute on function public.get_notifications(integer, boolean) to authenticated;

