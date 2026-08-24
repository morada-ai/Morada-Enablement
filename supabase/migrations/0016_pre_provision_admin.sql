-- Juliana Cestaro hasn't logged in yet, so there's no profiles row to grant
-- admin on. Pre-provision her role at signup time, the same way leadership
-- emails are already pre-provisioned below, so her first login already
-- lands as admin with no manual follow-up needed.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_team text;
  assigned_role text;
begin
  assigned_team := case lower(new.email)
    when 'karen.silva@morada.ai' then 'marketing'
    when 'pedro.miranda@morada.ai' then 'cs'
    when 'luiza.kolanscki@morada.ai' then 'onboarding,suporte'
    when 'lucas.carvalho@morada.ai' then 'tecnologia'
    when 'gabriel.chaves@morada.ai' then 'produto'
    when 'ramon@morada.ai' then 'all'
    when 'luis@morada.ai' then 'all'
    when 'gabriel.maracaipe@morada.ai' then 'all'
    else null
  end;

  assigned_role := case
    when lower(new.email) = 'juliana.cestaro@morada.ai' then 'admin'
    when assigned_team is not null then 'leader'
    else 'member'
  end;

  insert into public.profiles (id, email, full_name, avatar_url, role, leads_team)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    assigned_role,
    assigned_team
  );
  return new;
end;
$$;
