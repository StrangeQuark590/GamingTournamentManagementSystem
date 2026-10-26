/*
# Extend tournament hub with user, team, and organizer modules

## Plain-English summary
Adds data structures for full user/profile management, team management,
organizer-owned tournaments, and richer match scheduling. Builds on existing
games/tournaments/registrations/matches tables without dropping or renaming.

## New Tables
1. profiles — one row per signed-in user (display name, gamer tag, bio, role).
2. teams — a squad created by a captain, associated with a game.
3. team_members — roster of users on a team.

## Modified Tables
1. tournaments — adds organizer_id (nullable uuid → auth.users).
2. registrations — adds user_id and team_id.
3. matches — adds team_one_id, team_two_id, winner.

## Security
Signed-in multi-user app. All policies target authenticated.
- profiles: read any; insert/update only own.
- teams: read any; create (becomes captain); update/delete only own.
- team_members: read any; join (insert self); leave (delete self); captain removes members.
- tournaments: read any; insert/update/delete only own organizer rows.
- registrations: read own or on tournaments you organize; insert self; cancel own; organizer updates status.
- matches: read any; organizer of parent tournament manages matches.

## Notes
Owner columns default to auth.uid(). Existing seed tournaments keep null
organizer_id and remain public read-only. All statements idempotent.
*/

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  gamer_tag text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player','organizer','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Profiles are visible to authenticated users" ON public.profiles;
CREATE POLICY "Profiles are visible to authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert their own profile" ON public.profiles;
CREATE POLICY "Users insert their own profile"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update their own profile" ON public.profiles;
CREATE POLICY "Users update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. teams
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  captain_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;

DROP POLICY IF EXISTS "Teams are visible to authenticated users" ON public.teams;
CREATE POLICY "Teams are visible to authenticated users"
ON public.teams FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
CREATE POLICY "Authenticated users can create teams"
ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = captain_id);

DROP POLICY IF EXISTS "Captain can update their team" ON public.teams;
CREATE POLICY "Captain can update their team"
ON public.teams FOR UPDATE TO authenticated
USING (auth.uid() = captain_id) WITH CHECK (auth.uid() = captain_id);

DROP POLICY IF EXISTS "Captain can delete their team" ON public.teams;
CREATE POLICY "Captain can delete their team"
ON public.teams FOR DELETE TO authenticated USING (auth.uid() = captain_id);

-- 3. team_members
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('captain','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO service_role;

DROP POLICY IF EXISTS "Rosters are visible to authenticated users" ON public.team_members;
CREATE POLICY "Rosters are visible to authenticated users"
ON public.team_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can join teams" ON public.team_members;
CREATE POLICY "Users can join teams"
ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave teams" ON public.team_members;
CREATE POLICY "Users can leave teams"
ON public.team_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Captain can manage roster" ON public.team_members;
CREATE POLICY "Captain can manage roster"
ON public.team_members FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.captain_id = auth.uid()));

-- 4. tournaments — add organizer_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'tournaments'
                 AND column_name = 'organizer_id') THEN
    ALTER TABLE public.tournaments ADD COLUMN organizer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO service_role;

DROP POLICY IF EXISTS "Authenticated can view tournaments" ON public.tournaments;
CREATE POLICY "Authenticated can view tournaments"
ON public.tournaments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Organizer can create tournaments" ON public.tournaments;
CREATE POLICY "Organizer can create tournaments"
ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizer can update their tournaments" ON public.tournaments;
CREATE POLICY "Organizer can update their tournaments"
ON public.tournaments FOR UPDATE TO authenticated
USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizer can delete their tournaments" ON public.tournaments;
CREATE POLICY "Organizer can delete their tournaments"
ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = organizer_id);

-- 5. registrations — add user_id and team_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'registrations'
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.registrations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'registrations'
                 AND column_name = 'team_id') THEN
    ALTER TABLE public.registrations ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO service_role;

DROP POLICY IF EXISTS "Public can view registrations" ON public.registrations;
DROP POLICY IF EXISTS "Public can submit registrations" ON public.registrations;
DROP POLICY IF EXISTS "Users view own or organized registrations" ON public.registrations;
DROP POLICY IF EXISTS "Users register themselves" ON public.registrations;
DROP POLICY IF EXISTS "Users cancel own registration" ON public.registrations;
DROP POLICY IF EXISTS "Organizer updates registration status" ON public.registrations;

CREATE POLICY "Users view own or organized registrations"
ON public.registrations FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = registrations.tournament_id AND t.organizer_id = auth.uid()
  )
);

CREATE POLICY "Users register themselves"
ON public.registrations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own registration"
ON public.registrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Organizer updates registration status"
ON public.registrations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = registrations.tournament_id AND t.organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = registrations.tournament_id AND t.organizer_id = auth.uid()
  )
);

-- 6. matches — add team refs and winner
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'matches'
                 AND column_name = 'team_one_id') THEN
    ALTER TABLE public.matches ADD COLUMN team_one_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'matches'
                 AND column_name = 'team_two_id') THEN
    ALTER TABLE public.matches ADD COLUMN team_two_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'matches'
                 AND column_name = 'winner') THEN
    ALTER TABLE public.matches ADD COLUMN winner text;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO service_role;

DROP POLICY IF EXISTS "Public can view matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated can view matches" ON public.matches;
DROP POLICY IF EXISTS "Organizer can create matches" ON public.matches;
DROP POLICY IF EXISTS "Organizer can update matches" ON public.matches;
DROP POLICY IF EXISTS "Organizer can delete matches" ON public.matches;

CREATE POLICY "Authenticated can view matches"
ON public.matches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Organizer can create matches"
ON public.matches FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = matches.tournament_id AND t.organizer_id = auth.uid()
  )
);

CREATE POLICY "Organizer can update matches"
ON public.matches FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = matches.tournament_id AND t.organizer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = matches.tournament_id AND t.organizer_id = auth.uid()
  )
);

CREATE POLICY "Organizer can delete matches"
ON public.matches FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = matches.tournament_id AND t.organizer_id = auth.uid()
  )
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS teams_captain_idx ON public.teams(captain_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_team_idx ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS tournaments_organizer_idx ON public.tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS registrations_user_idx ON public.registrations(user_id);
