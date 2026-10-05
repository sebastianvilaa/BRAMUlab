-- BRAMUlab V04.33 — Rediseño de Recuperados + Partidos pendientes (handoff 129, Issue #29).
--
-- Cambio mínimo, forward-only, SOLO aditivo (no toca Nivel, Ranking, Team A/B, deduplicación ni la mecánica del vínculo):
--   1) provisional_claims.source_match_id + create_claim_link(uuid, uuid default null): el link recuerda el PARTIDO desde el que se
--      invitó (el motivo real por el que alguien compartió el link) para mostrarlo en "¿SOS X?". Opcional y validado: si no viene o no
--      es coherente (el invitador y la provisional deben figurar en él), queda NULL y la vista previa cae al partido más reciente.
--   2) preview_claim_link: usa ese partido de origen cuando sigue vigente y enriquece a los 4 participantes con @usuario y la RUTA de
--      avatar (solo para el receptor YA autenticado, mismo criterio que V04.30). Cuenta cuántos partidos MÁS tiene la identidad.
--   3) get_my_recent_recoveries(p_days): lotes de recuperación COMPLETADOS del propio caller dentro de la ventana (30 días por defecto).
--      El cliente deriva de ahí la pestaña temporal Historial > Recuperados; la fecha/lote ya viven en player_identity_recoveries
--      (completed_at/recovered_match_ids), así que NO hay tabla nueva ni estado duplicado: el servidor es la única autoridad de la ventana.
--   4) Notificación persistida 'identity_recovered' para el propio reclamante ("RECUPERAMOS N PARTIDOS"), por trigger sobre
--      player_identity_recoveries (no se toca claim_provisional_player). Distinta de 'identity_claimed' (al invitador), que se conserva.

-- ------------------------------------------------------------------
-- 1) provisional_claims.source_match_id + create_claim_link
-- ------------------------------------------------------------------

alter table public.provisional_claims
  add column if not exists source_match_id uuid references public.matches (match_id) on delete set null;

comment on column public.provisional_claims.source_match_id is
  'Partido desde el que se generó la invitación (V04.33). Opcional: contexto humano para "¿Sos X?"; nunca autoriza nada.';

-- Misma firma lógica + parámetro opcional: se reemplaza la función (un overload dejaría la llamada por nombre ambigua).
drop function if exists public.create_claim_link(uuid);

create or replace function public.create_claim_link(p_provisional_player_id uuid, p_source_match_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_token text;
  v_token_hash text;
  v_source_match_id uuid := null;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'create_claim_link', 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_provisional_player_id is null then
    raise exception 'provisional_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bramu:identity_recovery:prov:' || p_provisional_player_id::text, 7));

  if not public._can_invite_provisional(v_caller_player_id, p_provisional_player_id) then
    raise exception 'provisional_not_found' using errcode = 'P0001';
  end if;

  -- Partido de origen: solo si es coherente (el invitador Y la provisional figuran en él y no está anulado). Si no, se ignora en
  -- silencio (la vista previa cae al más reciente): el contexto nunca debe impedir generar la invitación.
  if p_source_match_id is not null then
    select m.match_id into v_source_match_id
      from public.matches m
     where m.match_id = p_source_match_id
       and m.status <> 'annulled'
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_caller_player_id)
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = p_provisional_player_id);
  end if;

  update public.provisional_claims
    set status = 'revoked', revoked_at = now(), revoked_reason = 'rotated'
    where provisional_player_id = p_provisional_player_id
      and created_by_player_id = v_caller_player_id
      and status = 'pending';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.provisional_claims (provisional_player_id, token_hash, status, created_by_player_id, expires_at, source_match_id)
  values (p_provisional_player_id, v_token_hash, 'pending', v_caller_player_id, now() + interval '30 days', v_source_match_id);

  return v_token;
end;
$$;

comment on function public.create_claim_link is
  'Genera/rota el link personal de invitación de una provisional (V04.33: recuerda opcionalmente el partido de origen). Autorizado por
   _can_invite_provisional. Rota solo el pending del mismo invitador. Devuelve el token crudo UNA sola vez; solo se persiste su sha256.';

revoke all on function public.create_claim_link(uuid, uuid) from public, anon;
grant execute on function public.create_claim_link(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- 2) preview_claim_link — partido de origen + identidad visual compacta de los 4 participantes
-- ------------------------------------------------------------------

create or replace function public.preview_claim_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_token text := trim(coalesce(p_token, ''));
  v_claim public.provisional_claims;
  v_prov public.players;
  v_match_count integer;
  v_source_match_id uuid := null;
  v_is_origin boolean := false;
  v_source jsonb;
begin
  select p.player_id into v_caller_player_id from public.players p where p.auth_user_id = auth.uid();
  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'preview_claim_link', 30, 900) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;

  select * into v_claim from public.provisional_claims
    where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  if v_claim is null then
    return jsonb_build_object('ok', false, 'code', 'claim_invalid');
  end if;
  if v_claim.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'claim_revoked');
  end if;
  if v_claim.status = 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;
  if v_claim.status = 'expired' or v_claim.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'claim_expired');
  end if;

  select * into v_prov from public.players where player_id = v_claim.provisional_player_id;
  if v_prov is null or v_prov.type <> 'provisional' or not v_prov.is_active or v_prov.recovered_into_player_id is not null then
    return jsonb_build_object('ok', false, 'code', 'claim_already_used');
  end if;

  select count(*)::int into v_match_count
    from public.matches m
   where m.status <> 'annulled'
     and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id);

  -- V04.33 — primero el partido que ORIGINÓ esta invitación (si sigue vigente y la identidad sigue figurando en él); si no hay o ya no
  -- aplica (links anteriores a V04.33), el más reciente de la identidad.
  if v_claim.source_match_id is not null then
    select m.match_id into v_source_match_id
      from public.matches m
     where m.match_id = v_claim.source_match_id
       and m.status <> 'annulled'
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id);
    v_is_origin := v_source_match_id is not null;
  end if;
  if v_source_match_id is null then
    select m.match_id into v_source_match_id
      from public.matches m
     where m.status <> 'annulled'
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id)
     order by m.played_at desc, m.match_id
     limit 1;
  end if;

  if v_source_match_id is not null then
    v_source := public._duplicate_candidate_match_json(v_source_match_id, null) - 'matchId' - 'myTeam';
    v_source := v_source
      || jsonb_build_object('loaderName', (
           select coalesce(nullif(btrim(lp.display_name), ''), 'Jugador')
             from public.matches m join public.players lp on lp.player_id = m.created_by_player_id
            where m.match_id = v_source_match_id))
      -- Identidad visual compacta: @usuario y RUTA de avatar solo de cuentas registradas activas; `isInvitee` marca el lugar de la identidad invitada.
      || jsonb_build_object('participants', (
           select jsonb_agg(jsonb_build_object(
             'team', mp.team, 'position', mp.position_in_team,
             'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot),
             'username', case when pl.type = 'registered' and pl.is_active and pl.deleted_at is null then pr.username else null end,
             'avatarPath', case when pl.type = 'registered' and pl.is_active and pl.deleted_at is null then pr.avatar_url else null end,
             'isInvitee', mp.player_id = v_prov.player_id
           ) order by mp.team, mp.position_in_team)
             from public.match_participants mp
             join public.players pl on pl.player_id = mp.player_id
             left join public.profiles pr on pr.player_id = mp.player_id
            where mp.match_id = v_source_match_id));
  end if;

  return jsonb_build_object(
    'ok', true, 'code', 'claim_valid',
    'displayName', coalesce(nullif(btrim(v_prov.display_name), ''), 'Jugador'),
    'matchCount', coalesce(v_match_count, 0),
    'sourceIsOrigin', v_is_origin,
    'sourceMatch', v_source
  );
end;
$$;

-- ------------------------------------------------------------------
-- 3) get_my_recent_recoveries — lotes de recuperación del propio caller dentro de la ventana especial
-- ------------------------------------------------------------------

/** Solo el TARGET (el propio caller) lee sus recuperaciones completadas. Devuelve ids de partido (los datos se leen con get_my_matches,
 *  que ya filtra por participación real) + el nombre con el que figuraba la identidad + el instante de recuperación. La ventana es de
 *  VISIBILIDAD ESPECIAL: los partidos no desaparecen del historial al vencer; tampoco vence el derecho a reportar un error. */
create or replace function public.get_my_recent_recoveries(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_rows jsonb;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'recoveryId', r.recovery_id,
           'sourceName', coalesce(nullif(btrim(sp.display_name), ''), 'Jugador'),
           'matchIds', to_jsonb(r.recovered_match_ids),
           'recoveredAt', coalesce(r.completed_at, r.created_at)
         ) order by coalesce(r.completed_at, r.created_at) desc), '[]'::jsonb)
    into v_rows
    from public.player_identity_recoveries r
    join public.players sp on sp.player_id = r.source_provisional_player_id
   where r.target_player_id = v_caller
     and r.status = 'completed'
     and coalesce(cardinality(r.recovered_match_ids), 0) > 0
     and coalesce(r.completed_at, r.created_at) > now() - make_interval(days => v_days);

  return jsonb_build_object('ok', true, 'recoveries', v_rows);
end;
$$;

revoke all on function public.get_my_recent_recoveries(integer) from public, anon;
grant execute on function public.get_my_recent_recoveries(integer) to authenticated;

-- ------------------------------------------------------------------
-- 4) Notificación persistida para el propio reclamante
-- ------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'pending_review', 'correction_proposed', 'correction_accepted',
  'identity_questioned', 'identity_resolved', 'identity_unidentified',
  'match_validated', 'match_expired', 'admin_action', 'identity_claimed', 'identity_recovered'
));

create or replace function public._notify_target_identity_recovered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and coalesce(cardinality(new.recovered_match_ids), 0) > 0
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into public.notifications (player_id, type, match_id, payload)
    values (
      new.target_player_id, 'identity_recovered', null,
      jsonb_build_object(
        'recoveryId', new.recovery_id,
        'matchCount', cardinality(new.recovered_match_ids),
        'sourceName', (select coalesce(nullif(btrim(sp.display_name), ''), 'Jugador')
                         from public.players sp where sp.player_id = new.source_provisional_player_id)
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public._notify_target_identity_recovered() from public, anon, authenticated;

drop trigger if exists player_identity_recoveries_notify_target on public.player_identity_recoveries;
create trigger player_identity_recoveries_notify_target
  after insert or update of status on public.player_identity_recoveries
  for each row execute function public._notify_target_identity_recovered();
