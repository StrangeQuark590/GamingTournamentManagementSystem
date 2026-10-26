export type Role = 'player' | 'organizer' | 'admin';

export type Profile = {
  id: string;
  display_name: string;
  gamer_tag: string;
  bio: string;
  avatar_url: string;
  role: Role;
  created_at: string;
  updated_at: string;
};

export type Game = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  platform: string;
  accent: string;
};

export type TournamentStatus = 'Upcoming' | 'Open' | 'Ongoing' | 'Completed' | 'Cancelled';

export type Tournament = {
  id: string;
  game_id: string;
  slug: string;
  title: string;
  format: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  entry_fee: number;
  prize_pool: number;
  max_participants: number;
  status: TournamentStatus;
  description: string;
  organizer_id: string | null;
  games?: Game;
};

export type RegistrationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type Registration = {
  id: string;
  tournament_id: string;
  entrant_name: string;
  email: string;
  entry_type: 'Solo' | 'Team';
  status: RegistrationStatus;
  registered_at: string;
  user_id: string | null;
  team_id: string | null;
  tournaments?: Pick<Tournament, 'id' | 'title' | 'slug'>;
};

export type MatchStatus = 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';

export type Match = {
  id: string;
  tournament_id: string;
  round_name: string;
  match_number: number;
  participant_one: string;
  participant_two: string;
  scheduled_time: string;
  status: MatchStatus;
  score_one: number;
  score_two: number;
  team_one_id: string | null;
  team_two_id: string | null;
  winner: string | null;
  tournaments?: { title: string; slug: string };
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  game_id: string | null;
  captain_id: string;
  description: string;
  region: string;
  created_at: string;
  games?: Game | null;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: 'captain' | 'member';
  joined_at: string;
  profiles?: Pick<Profile, 'id' | 'display_name' | 'gamer_tag'>;
};

export type View = 'dashboard' | 'tournaments' | 'matches' | 'teams' | 'profile' | 'auth';
