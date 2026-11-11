-- Sage Phase 2: Run in Supabase SQL editor as project owner.
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', created_at timestamptz not null default now());
create table if not exists public.households (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.household_members (household_id uuid not null references public.households(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, joined_at timestamptz not null default now(), primary key(household_id,user_id), unique(user_id));
create table if not exists public.household_invites (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, created_by uuid not null references auth.users(id), token_hash text not null unique, target_email text, expires_at timestamptz not null, redeemed_by uuid references auth.users(id), redeemed_at timestamptz, created_at timestamptz not null default now());
create index if not exists household_invites_household_idx on public.household_invites(household_id);
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
revoke all on public.household_invites from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
-- Avoid recursive member-to-member policy by looking up only the caller's membership in a security-definer function.
create or replace function public.my_household_id() returns uuid language sql stable security definer set search_path='' as $$select household_id from public.household_members where user_id=(select auth.uid()) limit 1$$;
revoke all on function public.my_household_id() from public,anon;
grant execute on function public.my_household_id() to authenticated;
drop policy if exists profile_self_select on public.profiles;
create policy profile_self_select on public.profiles for select to authenticated using (id=(select auth.uid()));
drop policy if exists profile_self_insert on public.profiles;
create policy profile_self_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists household_member_read on public.households;
create policy household_member_read on public.households for select to authenticated using(id=(select public.my_household_id()));
drop policy if exists member_read on public.household_members;
create policy member_read on public.household_members for select to authenticated using(household_id=(select public.my_household_id()));
-- No direct authenticated write permissions for households, members, or invites.
revoke insert,update,delete on public.households from anon,authenticated;
revoke insert,update,delete on public.household_members from anon,authenticated;
create or replace function public.create_household(household_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Sign in first'; end if;
 if length(trim(coalesce(household_name,''))) not between 1 and 100 then raise exception 'Invalid household name'; end if;
 if exists(select 1 from public.household_members where user_id=u) then raise exception 'You already belong to a household'; end if;
 insert into public.households(name,created_by) values(trim(household_name),u) returning id into h;
 insert into public.household_members(household_id,user_id) values(h,u);
 return h;
end $$;
create or replace function public.create_household_invite(target_email text default null) returns text language plpgsql security definer set search_path='' as $$
declare h uuid; token text; n int;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select household_id into h from public.household_members where user_id=auth.uid();
 if h is null then raise exception 'Join a household first'; end if;
 if target_email is not null and (length(trim(target_email))>254 or position('@' in target_email)=0) then raise exception 'Invalid email'; end if;
 select count(*) into n from public.household_invites where household_id=h and expires_at>now() and redeemed_at is null;
 if n>=5 then raise exception 'Too many active invites; wait for expiry'; end if;
 token:=upper(encode(gen_random_bytes(16),'hex'));
 insert into public.household_invites(household_id,created_by,token_hash,target_email,expires_at)
 values(h,auth.uid(),encode(digest(token,'sha256'),'hex'),nullif(lower(trim(target_email)),''),now()+interval '24 hours');
 return token;
end $$;
create or replace function public.accept_household_invite(raw_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.household_invites%rowtype; u uuid:=auth.uid(); e text;
begin
 if u is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.household_members where user_id=u) then raise exception 'You already belong to a household'; end if;
 if length(coalesce(raw_code,''))<>32 then raise exception 'Invalid invitation'; end if;
 select * into inv from public.household_invites where token_hash=encode(digest(upper(trim(raw_code)),'sha256'),'hex') and redeemed_at is null and expires_at>now() for update;
 if inv.id is null then raise exception 'Invalid or expired invitation'; end if;
 select lower(email) into e from auth.users where id=u;
 if inv.target_email is not null and inv.target_email<>e then raise exception 'This invitation is for another email address'; end if;
 if (select count(*) from public.household_members where household_id=inv.household_id)>=2 then raise exception 'Household is full'; end if;
 insert into public.household_members(household_id,user_id) values(inv.household_id,u);
 update public.household_invites set redeemed_by=u,redeemed_at=now() where id=inv.id;
 return inv.household_id;
end $$;
revoke all on function public.create_household(text) from public,anon;
revoke all on function public.create_household_invite(text) from public,anon;
revoke all on function public.accept_household_invite(text) from public,anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invite(text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
-- Partner financial summaries deliberately NOT implemented: no finance tables exist in Phase 2.
-- Before real financial data, create restricted aggregate RPCs and test with two authenticated users.
