-- ============================================================
-- Fairway Golf Analytics — Supabase Schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- Enable RLS helper extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  display_name  text,
  handicap_index numeric(4,1) default 0,
  home_course   text,
  created_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROUNDS
-- ============================================================
create table public.rounds (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  date            date not null,
  course_name     text not null,
  tees            text,               -- e.g. 'Blue', 'White'
  weather         text,               -- e.g. 'Sunny', 'Windy'
  score           integer,
  par             integer default 72,
  putts           integer,
  gir             integer,            -- greens in regulation count
  fir_made        integer,            -- fairways hit
  fir_total       integer,            -- fairways attempted (excludes par 3s)
  sg_ott          numeric(5,3),       -- strokes gained off the tee
  sg_app          numeric(5,3),       -- strokes gained approach
  sg_arg          numeric(5,3),       -- strokes gained around the green
  sg_putt         numeric(5,3),       -- strokes gained putting
  penalties       integer default 0,
  sand_saves      integer default 0,
  three_putts     integer default 0,
  one_putts       integer default 0,
  course_rating   numeric(4,1),
  slope_rating    integer,
  handicap_diff   numeric(4,1),       -- (score - course_rating) * 113 / slope_rating
  notes           text,
  mental_score    integer,            -- 1-10 self assessment
  energy_score    integer,            -- 1-10 self assessment
  created_at      timestamptz default now()
);

-- ============================================================
-- HOLES
-- ============================================================
create table public.holes (
  id          uuid default uuid_generate_v4() primary key,
  round_id    uuid references public.rounds(id) on delete cascade not null,
  hole_number integer not null check (hole_number between 1 and 18),
  par         integer not null check (par between 3 and 5),
  score       integer,
  putts       integer,
  gir         boolean default false,
  fir         boolean,                -- null for par 3s
  sg_total    numeric(5,3)
);

-- ============================================================
-- SHOTS
-- ============================================================
create table public.shots (
  id                    uuid default uuid_generate_v4() primary key,
  round_id              uuid references public.rounds(id) on delete cascade not null,
  hole_number           integer not null,
  shot_number           integer not null,
  club                  text,                 -- e.g. 'Driver', '7-iron'
  start_lie             text,                 -- 'tee','fairway','rough','sand','green','recovery'
  end_lie               text,
  start_lat             double precision,
  start_lng             double precision,
  end_lat               double precision,
  end_lng               double precision,
  dist_yards            integer,              -- shot distance
  dist_to_flag_before   integer,              -- yards to pin before shot
  dist_to_flag_after    integer,              -- yards to pin after shot
  sg                    numeric(5,3),         -- strokes gained this shot
  sg_category           text,                 -- 'ott','app','arg','putt'
  is_holed              boolean default false
);

-- ============================================================
-- BAG (club distances)
-- ============================================================
create table public.bag (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  club_name     text not null,
  avg_distance  integer,
  carry_distance integer,
  max_distance  integer,
  sort_order    integer default 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.rounds    enable row level security;
alter table public.holes     enable row level security;
alter table public.shots     enable row level security;
alter table public.bag       enable row level security;

-- Profiles: users can only see/edit their own
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- Rounds: own rows only
create policy "rounds: own rows" on public.rounds
  for all using (auth.uid() = user_id);

-- Holes: own rounds only (join through rounds)
create policy "holes: own rounds" on public.holes
  for all using (
    exists (
      select 1 from public.rounds r
      where r.id = holes.round_id and r.user_id = auth.uid()
    )
  );

-- Shots: own rounds only
create policy "shots: own rounds" on public.shots
  for all using (
    exists (
      select 1 from public.rounds r
      where r.id = shots.round_id and r.user_id = auth.uid()
    )
  );

-- Bag: own rows only
create policy "bag: own rows" on public.bag
  for all using (auth.uid() = user_id);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

create index rounds_user_id_date on public.rounds (user_id, date desc);
create index holes_round_id on public.holes (round_id);
create index shots_round_id on public.shots (round_id, hole_number, shot_number);
create index bag_user_id on public.bag (user_id, sort_order);
