-- Replaces the single global tracks.is_required boolean with per-team
-- required assignments, so a trilha can be mandatory for some teams and
-- not others. 'all' is a sentinel meaning required for everyone, the same
-- convention profiles.leads_team already uses — never combined with
-- specific teams on the same track.
create table track_required_teams (
  track_id text not null references tracks(id) on delete cascade,
  team text not null,
  created_at timestamptz not null default now(),
  primary key (track_id, team)
);

alter table track_required_teams enable row level security;

create policy read_track_required_teams on track_required_teams for select to authenticated using (true);
create policy admin_write_track_required_teams on track_required_teams for all to authenticated
  using (is_admin()) with check (is_admin());

-- Preserve current behavior for trilhas already marked required.
insert into track_required_teams (track_id, team)
select id, 'all' from tracks where is_required = true;

alter table tracks drop column is_required;
