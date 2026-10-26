/*
# Create tournament hub schema and public starter data

1. New Tables
- `games`: supported game titles and platforms.
- `tournaments`: tournament listings, format, dates, entry fee, capacity, and status.
- `registrations`: player or team entries for a tournament, with entrant name and approval status.
- `matches`: scheduled rounds, slots, and match status for tournament schedules.

2. Security
- Enable row-level security on every table.
- The app is intentionally a shared public tournament board with no sign-in screen, so anon and authenticated roles can read public data and submit registrations.
- Grants are limited to the verbs used by the app.

3. Important notes
- Registrations are append-only from the app and preserve a registration history.
- Unique slugs and registration email/tournament pairs prevent accidental duplicate entries.
- Starter rows make the deployed experience useful immediately while remaining editable through the app's future organizer tools.
*/

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  genre text NOT NULL,
  platform text NOT NULL,
  accent text NOT NULL DEFAULT 'cyan',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  format text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  registration_deadline timestamptz NOT NULL,
  entry_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  prize_pool numeric(10,2) NOT NULL DEFAULT 0 CHECK (prize_pool >= 0),
  max_participants integer NOT NULL DEFAULT 64 CHECK (max_participants > 0),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Upcoming', 'Open', 'Ongoing', 'Completed', 'Cancelled')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  entrant_name text NOT NULL,
  email text NOT NULL,
  entry_type text NOT NULL DEFAULT 'Solo' CHECK (entry_type IN ('Solo', 'Team')),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, email)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  round_name text NOT NULL,
  match_number integer NOT NULL,
  participant_one text NOT NULL,
  participant_two text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Live', 'Completed', 'Cancelled')),
  score_one integer NOT NULL DEFAULT 0 CHECK (score_one >= 0),
  score_two integer NOT NULL DEFAULT 0 CHECK (score_two >= 0),
  UNIQUE (tournament_id, round_name, match_number)
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.games TO anon, authenticated;
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT SELECT, INSERT ON public.registrations TO anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view games" ON public.games;
CREATE POLICY "Public can view games" ON public.games FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can view tournaments" ON public.tournaments;
CREATE POLICY "Public can view tournaments" ON public.tournaments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can view registrations" ON public.registrations;
CREATE POLICY "Public can view registrations" ON public.registrations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can submit registrations" ON public.registrations;
CREATE POLICY "Public can submit registrations" ON public.registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can view matches" ON public.matches;
CREATE POLICY "Public can view matches" ON public.matches FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS tournaments_status_start_idx ON public.tournaments(status, start_date);
CREATE INDEX IF NOT EXISTS registrations_tournament_idx ON public.registrations(tournament_id);
CREATE INDEX IF NOT EXISTS matches_tournament_schedule_idx ON public.matches(tournament_id, scheduled_time);

INSERT INTO public.games (slug, name, genre, platform, accent)
VALUES
  ('valorant', 'VALORANT', 'Tactical shooter', 'PC', 'red'),
  ('rocket-league', 'Rocket League', 'Sports / action', 'Cross-platform', 'blue'),
  ('street-fighter-6', 'Street Fighter 6', 'Fighting', 'PC / Console', 'amber')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tournaments (game_id, slug, title, format, start_date, end_date, registration_deadline, entry_fee, prize_pool, max_participants, status, description)
VALUES
  ((SELECT id FROM public.games WHERE slug = 'valorant'), 'nightfall-invitational', 'Nightfall Invitational', '5v5 · Single elimination', '2026-11-14 17:00:00+00', '2026-11-15 22:00:00+00', '2026-11-12 23:59:00+00', 12, 2500, 32, 'Open', 'A high-intensity weekend bracket for teams who want to test their coordination under pressure.'),
  ((SELECT id FROM public.games WHERE slug = 'rocket-league'), 'neon-cup', 'Neon Cup // Duos', '2v2 · Double elimination', '2026-11-21 16:00:00+00', '2026-11-21 23:00:00+00', '2026-11-20 20:00:00+00', 8, 1200, 64, 'Open', 'Fast rotations, clean mechanics, and a short-format bracket built for an electric Saturday night.'),
  ((SELECT id FROM public.games WHERE slug = 'street-fighter-6'), 'dojo-clash', 'Dojo Clash #08', '1v1 · Round robin', '2026-11-28 18:00:00+00', '2026-11-28 23:30:00+00', '2026-11-27 18:00:00+00', 5, 800, 48, 'Upcoming', 'A welcoming local bracket with pools, finals, and a spotlight on the next generation of fighters.'),
  ((SELECT id FROM public.games WHERE slug = 'valorant'), 'aftershock-series', 'Aftershock Series: Stage 02', '5v5 · Swiss stage', '2026-10-31 18:00:00+00', '2026-11-01 22:00:00+00', '2026-10-29 23:59:00+00', 15, 5000, 64, 'Ongoing', 'The second stage of our ranked circuit. Follow the live bracket and catch every result as it lands.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.registrations (tournament_id, entrant_name, email, entry_type, status)
VALUES
  ((SELECT id FROM public.tournaments WHERE slug = 'nightfall-invitational'), 'Pixel Pioneers', 'captain@pixelpioneers.gg', 'Team', 'Approved'),
  ((SELECT id FROM public.tournaments WHERE slug = 'nightfall-invitational'), 'Orbit Five', 'hello@orbitfive.gg', 'Team', 'Approved'),
  ((SELECT id FROM public.tournaments WHERE slug = 'neon-cup'), 'Mira & Sol', 'mira@example.com', 'Team', 'Approved'),
  ((SELECT id FROM public.tournaments WHERE slug = 'dojo-clash'), 'Kai Nakamura', 'kai@example.com', 'Solo', 'Pending')
ON CONFLICT (tournament_id, email) DO NOTHING;

INSERT INTO public.matches (tournament_id, round_name, match_number, participant_one, participant_two, scheduled_time, status, score_one, score_two)
VALUES
  ((SELECT id FROM public.tournaments WHERE slug = 'aftershock-series'), 'Swiss Round 3', 1, 'Riftwalkers', 'NOVA Core', '2026-10-26 19:30:00+00', 'Live', 8, 6),
  ((SELECT id FROM public.tournaments WHERE slug = 'aftershock-series'), 'Swiss Round 3', 2, 'Blue Shift', 'Kestrel', '2026-10-26 20:15:00+00', 'Scheduled', 0, 0),
  ((SELECT id FROM public.tournaments WHERE slug = 'aftershock-series'), 'Swiss Round 3', 3, 'Monarch', 'Lowkey', '2026-10-26 21:00:00+00', 'Scheduled', 0, 0),
  ((SELECT id FROM public.tournaments WHERE slug = 'nightfall-invitational'), 'Quarterfinals', 1, 'Pixel Pioneers', 'Orbit Five', '2026-11-15 18:00:00+00', 'Scheduled', 0, 0)
ON CONFLICT (tournament_id, round_name, match_number) DO NOTHING;