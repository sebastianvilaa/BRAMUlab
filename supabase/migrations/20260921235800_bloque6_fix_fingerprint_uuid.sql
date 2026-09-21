-- BRAMUlab — Bloque 6: hotfix de participant_fingerprint en Staging ya migrado.
--
-- PostgreSQL no define max(uuid). El helper lee cada slot por su clave natural
-- (match_id, team, position_in_team) y mantiene el mismo algoritmo de fingerprint.

create or replace function public._bloque6_refresh_participant_fingerprint(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a1 uuid;
  v_a2 uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_pair_a_key text;
  v_pair_b_key text;
  v_fingerprint text;
begin
  -- Un match tiene a lo sumo un slot por (team, position_in_team); leerlos directo evita
  -- depender de agregados sobre uuid (PostgreSQL no define max(uuid)).
  select player_id into v_a1 from public.match_participants
    where match_id = p_match_id and team = 'A' and position_in_team = 1;
  select player_id into v_a2 from public.match_participants
    where match_id = p_match_id and team = 'A' and position_in_team = 2;
  select player_id into v_b1 from public.match_participants
    where match_id = p_match_id and team = 'B' and position_in_team = 1;
  select player_id into v_b2 from public.match_participants
    where match_id = p_match_id and team = 'B' and position_in_team = 2;

  if v_a1 is not null and v_a2 is not null and v_b1 is not null and v_b2 is not null then
    -- EXACTAMENTE el mismo algoritmo que create_or_attach_match (Bloque 5) — nunca se
    -- reimplementa distinto: ordenar IDs dentro de cada pareja, ordenar ambas parejas,
    -- sha256(pairA|pairB).
    v_pair_a_key := least(v_a1::text, v_a2::text) || ':' || greatest(v_a1::text, v_a2::text);
    v_pair_b_key := least(v_b1::text, v_b2::text) || ':' || greatest(v_b1::text, v_b2::text);
    v_fingerprint := encode(
      extensions.digest(least(v_pair_a_key, v_pair_b_key) || '|' || greatest(v_pair_a_key, v_pair_b_key), 'sha256'),
      'hex'
    );
  else
    -- Al menos un slot sin identidad: centinela determinístico y único por match_id — jamás
    -- coincide con un hash sha256 real (formato distinto, nunca 64 caracteres hex puros)
    -- mientras exista un slot no identificado/open.
    v_fingerprint := 'bloque6_unidentified:' || p_match_id::text;
  end if;

  update public.matches set participant_fingerprint = v_fingerprint, updated_at = now()
    where match_id = p_match_id;
end;
$$;

comment on function public._bloque6_refresh_participant_fingerprint is
  'Recalcula matches.participant_fingerprint tras cualquier cambio de identidad de Bloque 6
   (B6-B-04). Con los 4 player_id conocidos, EXACTAMENTE el mismo hash que create_or_attach_match
   (Bloque 5) — nunca un algoritmo distinto. Con algún slot NULL, un centinela determinístico por
   match_id que nunca colisiona con un hash real. Interno, sin GRANT.';

revoke all on function public._bloque6_refresh_participant_fingerprint(uuid) from public;
