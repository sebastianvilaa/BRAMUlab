-- BRAMUlab — Ronda UX 25/09 (Ronda 2, §9/§10): enriquecimiento mínimo/aditivo de notificaciones
-- con el actor real, siguiendo exactamente el criterio pedido en la revisión central: "si el
-- actor/contexto se puede enriquecer de forma confiable en UNA lectura, preferí una extensión
-- mínima/aditiva" — sin resolver esto con N llamadas por tarjeta de notificación, y sin tocar
-- ninguna arquitectura nueva.
--
-- Auditoría previa (leída de las migraciones ya aplicadas, no fue necesario tocar Staging):
--   - `notifications.payload` ya existe (20260921213000_bloque6_notifications.sql) documentado
--     como "quién actuó, qué cambió" — pensado desde el origen para esto, pero solo
--     `correction_proposed` (que hoy se DERIVA en lectura, ver get_notifications más abajo) lo
--     llena con un actor real. Los 4 tipos PERSISTIDOS `match_validated`/`correction_accepted`/
--     `identity_resolved`/`identity_unidentified` se insertan con payload literalmente
--     `'{}'::jsonb` en 20260924110000_bloque6_public_match_outcomes.sql (función
--     `officialize_match_validation`, ~500 líneas) y con payload sin actor en
--     20260921230000_bloque6_correction_and_identity_rpcs.sql (dos sitios más, resolución de
--     identidad PRE-validación) — pese a que en los 3 archivos el actor real ya está en una
--     variable local, usada un statement antes para `match_actions.actor_player_id`.
--   - Reescribir `officialize_match_validation` entera (CREATE OR REPLACE exige el cuerpo
--     completo) solo para agregar una clave al payload es una migración grande y de alto riesgo
--     por copiar a mano ~500 líneas PL/pgSQL ajenas sin poder ejecutarlas en este sandbox (sin
--     credenciales de Supabase acá, ver todas las rondas anteriores). Un trigger BEFORE INSERT
--     sobre `notifications` logra el mismo resultado observable con una superficie de cambio
--     mínima y aditiva, sin tocar una sola línea de las funciones productoras existentes — y
--     enriquece automáticamente cualquier futuro insert que siga el mismo patrón, sin requerir
--     que cada nueva RPC productora se acuerde de hacerlo.
--
-- Contrato viejo: para match_validated/correction_accepted/identity_resolved/
-- identity_unidentified, `payload` llega sin actor (`{}` o sin la clave).
-- Contrato nuevo (aditivo, retrocompatible): esos mismos 4 tipos ahora llegan además con
-- `payload.actorPlayerId` = `match_actions.actor_player_id` de la fila más reciente para ese
-- `match_id` en el momento del insert — que en TODOS los sitios productores actuales es,
-- exactamente, la fila que la propia función insertó un statement antes (misma transacción,
-- mismo partido). Un frontend que todavía no lea esa clave sigue funcionando exactamente igual
-- que antes: el payload solo GANA una clave, nunca pierde ni cambia una existente, y el trigger
-- nunca pisa `actorPlayerId` si el productor ya la hubiera puesto.
--
-- 'admin_action' queda EXPLÍCITAMENTE afuera a propósito: `admin_annul_match`
-- (20260921233000_bloque6_admin_rpcs.sql) usa `v_match.created_by_player_id` como valor de
-- `match_actions.actor_player_id` — un PLACEHOLDER documentado en ese mismo archivo ("NOT NULL
-- desde Bloque 5... una acción administrativa usa created_by_player_id... y dice quién actuó
-- realmente en metadata.adminActorLabel"). Enriquecer con ese valor mostraría al CREADOR del
-- partido como si hubiera sido quien anuló — exactamente el actor inventado que el handoff
-- prohíbe. El actor real de una anulación administrativa es texto libre
-- (`payload.action`/`payload.reason`, ya presentes), no un player_id.
-- 'match_expired' también queda afuera: verificado con grep sobre TODAS las migraciones, ningún
-- camino lo inserta hoy — solo existe como código de error de RPC (`match_expired`), nunca como
-- fila real de `notifications`. No hay nada que enriquecer.
--
-- Límite conocido y aceptado: si alguna vez una misma transacción insertara más de una fila de
-- match_actions para el mismo match_id antes del insert en notifications (ningún productor
-- actual lo hace — se verificó cada sitio), "la más reciente por occurred_at" podría no ser
-- exactamente la de este evento puntual. Degrada a mostrar un actor "razonablemente reciente"
-- del mismo partido, nunca corrompe ni inventa un dato — mismo criterio de "mejor esfuerzo,
-- nunca autoridad" que el resto de esta capa de lectura.

create or replace function public._bloque6_enrich_notification_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_player_id uuid;
begin
  if new.type in ('match_validated', 'correction_accepted', 'identity_resolved', 'identity_unidentified')
     and new.match_id is not null
     and not (coalesce(new.payload, '{}'::jsonb) ? 'actorPlayerId') then
    select actor_player_id into v_actor_player_id
    from public.match_actions
    where match_id = new.match_id
    order by occurred_at desc
    limit 1;

    if v_actor_player_id is not null then
      new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('actorPlayerId', v_actor_player_id);
    end if;
  end if;
  return new;
end;
$$;

comment on function public._bloque6_enrich_notification_actor is
  'BEFORE INSERT en notifications: agrega payload.actorPlayerId desde el match_actions.actor_player_id
   más reciente del mismo match_id, solo para los 4 tipos donde ese actor es real y no inventado
   (nunca admin_action, que usa un placeholder — ver comentario de la migración que lo crea).
   Aditivo: nunca pisa actorPlayerId si el productor ya lo hubiera puesto.';

drop trigger if exists bloque6_enrich_notification_actor on public.notifications;
create trigger bloque6_enrich_notification_actor
  before insert on public.notifications
  for each row
  execute function public._bloque6_enrich_notification_actor();

-- ------------------------------------------------------------------
-- get_notifications: agrega openedByPlayerId a la tarea derivada `identity_questioned` — mismo
-- criterio de "una sola lectura, dato ya joineado": match_identity_issues.opened_by_player_id ya
-- se lee en este mismo query (mii.*), solo faltaba proyectarlo en el jsonb_build_object. CREATE
-- OR REPLACE puro sobre la MISMA firma/columnas de retorno que
-- 20260921235500_bloque6_fix_notifications_ambiguity.sql (última definición aplicada) — el resto
-- del cuerpo se preserva sin tocar una sola línea.
-- ------------------------------------------------------------------

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
      --    participante habilitado. Ronda UX 25/09 (Ronda 2, §10) — agrega openedByPlayerId: ya
      --    se leía mii.opened_by_player_id vía mii.*, solo faltaba proyectarlo acá; permite al
      --    frontend decir "X cuestionó esta identidad" en vez de copy genérico, sin RPC nueva.
      select
        (regexp_replace(md5('identity_questioned:' || mii.issue_id::text), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '\1-\2-\3-\4-\5'))::uuid,
        'identity_questioned'::text,
        mii.match_id,
        jsonb_build_object('issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team, 'openedByPlayerId', mii.opened_by_player_id),
        mii.opened_at,
        null::timestamptz
      from public.match_identity_issues mii
      join public.match_participants mp on mp.match_id = mii.match_id and mp.player_id = v_caller_player_id
      where mii.status = 'open'

      union all

      -- 4) notificaciones PERSISTIDAS informativas — eventos ya consumados (match_validated,
      --    correction_accepted, identity_resolved/unidentified, admin_action, etc.). payload ya
      --    viene enriquecido con actorPlayerId (cuando corresponde) por el trigger BEFORE INSERT
      --    bloque6_enrich_notification_actor de esta misma migración — get_notifications solo lo
      --    proyecta tal cual, sin tocar nada acá.
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
   leídas) con notificaciones persistidas informativas (eventos ya ocurridos). Ronda UX 25/09
   (Ronda 2, §10): identity_questioned suma openedByPlayerId; las persistidas informativas llegan
   con payload.actorPlayerId ya enriquecido por el trigger de esta misma migración, para los 4
   tipos donde ese actor es real (nunca admin_action).';

revoke all on function public.get_notifications(integer, boolean) from public;
grant execute on function public.get_notifications(integer, boolean) to authenticated;
