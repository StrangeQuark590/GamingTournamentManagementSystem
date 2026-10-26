import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Menu,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/format';
import type { Game, Match, Registration, Team, TeamMember, Tournament, View } from '@/lib/types';
import { AuthScreen } from '@/components/AuthScreen';
import { Dashboard } from '@/components/Dashboard';
import { TournamentsView } from '@/components/TournamentsView';
import { MatchesView } from '@/components/MatchesView';
import { TeamsView } from '@/components/TeamsView';
import { ProfileView } from '@/components/ProfileView';

const NAV_ITEMS: { view: View; label: string; icon: typeof Trophy }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { view: 'tournaments', label: 'Tournaments', icon: Trophy },
  { view: 'matches', label: 'Matches', icon: CalendarDays },
  { view: 'teams', label: 'Teams', icon: Users },
];

function Shell() {
  const { user, profile, loading, error: authError, signOut } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [games, setGames] = useState<Game[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setDataLoading(true);
    const [gamesR, tournamentsR, registrationsR, matchesR, teamsR, membersR] = await Promise.all([
      supabase.from('games').select('*').order('name'),
      supabase.from('tournaments').select('*, games(*)').order('start_date'),
      supabase.from('registrations').select('*, tournaments(id, title, slug)').order('registered_at', { ascending: false }),
      supabase.from('matches').select('*, tournaments(title, slug)').order('scheduled_time'),
      supabase.from('teams').select('*, games(*)').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*, profiles(id, display_name, gamer_tag)').order('joined_at'),
    ]);

    const firstError = gamesR.error ?? tournamentsR.error ?? registrationsR.error ?? matchesR.error ?? teamsR.error ?? membersR.error;
    if (firstError) {
      setError('We could not load the tournament board right now. Please refresh.');
    } else {
      setGames(gamesR.data as Game[] ?? []);
      setTournaments((tournamentsR.data as Tournament[]) ?? []);
      setRegistrations((registrationsR.data as Registration[]) ?? []);
      setMatches((matchesR.data as Match[]) ?? []);
      setTeams((teamsR.data as Team[]) ?? []);
      setTeamMembers((membersR.data as TeamMember[]) ?? []);
      setError('');
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  const membersByTeam = useMemo(() => {
    const map: Record<string, TeamMember[]> = {};
    for (const m of teamMembers) {
      (map[m.team_id] ??= []).push(m);
    }
    return map;
  }, [teamMembers]);

  const myRegistrations = useMemo(
    () => registrations.filter((r) => r.user_id === user?.id),
    [registrations, user?.id],
  );

  const myTeams = useMemo(
    () => teams.filter((t) => t.captain_id === user?.id || (membersByTeam[t.id] ?? []).some((m) => m.user_id === user?.id)),
    [teams, membersByTeam, user?.id],
  );

  const myTeamsForRegister = useMemo(
    () => myTeams.map((t) => ({ id: t.id, name: t.name })),
    [myTeams],
  );

  // ---- Tournament actions ----
  const handleCreateTournament = async (values: Record<string, string>) => {
    if (!supabase || !user) return;
    const game = games.find((g) => g.name === values.gameName);
    const startDate = values.startDate ? new Date(values.startDate).toISOString() : new Date().toISOString();
    const endDate = values.startDate ? new Date(values.startDate).toISOString() : startDate;
    const regDeadline = values.registrationDeadline ? new Date(values.registrationDeadline).toISOString() : startDate;
    const { data, error: err } = await supabase
      .from('tournaments')
      .insert({
        title: values.title,
        slug: slugify(`${values.title}-${Date.now()}`),
        game_id: game?.id ?? games[0]?.id,
        format: values.format,
        start_date: startDate,
        end_date: endDate,
        registration_deadline: regDeadline,
        entry_fee: Number(values.entryFee) || 0,
        prize_pool: Number(values.prizePool) || 0,
        max_participants: Number(values.maxParticipants) || 32,
        status: 'Open',
        description: values.description,
        organizer_id: user.id,
      })
      .select('*, games(*)')
      .single();
    if (err) { setError('Could not create the tournament.'); return; }
    setTournaments((prev) => [data as Tournament, ...prev]);
  };

  const handleRegister = async (
    tournament: Tournament,
    values: { entrantName: string; email: string; entryType: 'Solo' | 'Team'; teamId?: string | null },
  ) => {
    if (!supabase || !user) return;
    const { data, error: err } = await supabase
      .from('registrations')
      .insert({
        tournament_id: tournament.id,
        entrant_name: values.entrantName,
        email: values.email,
        entry_type: values.entryType,
        user_id: user.id,
        team_id: values.teamId || null,
      })
      .select('*, tournaments(id, title, slug)')
      .single();
    if (err) {
      setError(err.code === '23505' ? 'You are already registered for this tournament.' : 'Registration could not be completed.');
      return;
    }
    setRegistrations((prev) => [data as Registration, ...prev]);
  };

  const handleCancelRegistration = async (registrationId: string) => {
    if (!supabase) return;
    const { error: err } = await supabase.from('registrations').delete().eq('id', registrationId);
    if (err) { setError('Could not cancel your registration.'); return; }
    setRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
  };

  const handleUpdateRegistrationStatus = async (registrationId: string, status: 'Approved' | 'Rejected') => {
    if (!supabase) return;
    const { error: err } = await supabase.from('registrations').update({ status }).eq('id', registrationId);
    if (err) { setError('Could not update registration status.'); return; }
    setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, status } : r)));
  };

  // ---- Match actions ----
  const handleCreateMatch = async (values: Record<string, string>) => {
    if (!supabase || !user) return;
    const tournament = tournaments.find((t) => t.title === values.tournamentTitle && t.organizer_id === user.id);
    if (!tournament) { setError('Select one of your tournaments.'); return; }
    const { data, error: err } = await supabase
      .from('matches')
      .insert({
        tournament_id: tournament.id,
        round_name: values.roundName,
        match_number: Math.floor(Math.random() * 1000) + 1,
        participant_one: values.participantOne,
        participant_two: values.participantTwo,
        scheduled_time: new Date(values.scheduledTime).toISOString(),
        status: 'Scheduled',
      })
      .select('*, tournaments(title, slug)')
      .single();
    if (err) { setError('Could not schedule the match.'); return; }
    setMatches((prev) => [...prev, data as Match]);
  };

  const handleUpdateMatch = async (
    matchId: string,
    values: { status: Match['status']; scoreOne: number; scoreTwo: number; winner: string | null },
  ) => {
    if (!supabase) return;
    const { error: err } = await supabase
      .from('matches')
      .update({ status: values.status, score_one: values.scoreOne, score_two: values.scoreTwo, winner: values.winner })
      .eq('id', matchId);
    if (err) { setError('Could not update the match.'); return; }
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...values } : m)));
  };

  // ---- Team actions ----
  const handleCreateTeam = async (values: Record<string, string>) => {
    if (!supabase || !user) return;
    const game = games.find((g) => g.name === values.gameName);
    const { data, error: err } = await supabase
      .from('teams')
      .insert({
        name: values.name,
        slug: slugify(`${values.name}-${Date.now()}`),
        game_id: game?.id ?? null,
        captain_id: user.id,
        description: values.description,
        region: values.region,
      })
      .select('*, games(*)')
      .single();
    if (err) { setError('Could not create the team.'); return; }
    const team = data as Team;
    setTeams((prev) => [team, ...prev]);
    // captain auto-joins as a member
    const { data: memberData } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, user_id: user.id, role: 'captain' })
      .select('*, profiles(id, display_name, gamer_tag)')
      .single();
    if (memberData) setTeamMembers((prev) => [...prev, memberData as TeamMember]);
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!supabase || !user) return;
    const { data, error: err } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: user.id, role: 'member' })
      .select('*, profiles(id, display_name, gamer_tag)')
      .single();
    if (err) { setError(err.code === '23505' ? 'You are already on this team.' : 'Could not join the team.'); return; }
    setTeamMembers((prev) => [...prev, data as TeamMember]);
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', user.id);
    if (err) { setError('Could not leave the team.'); return; }
    setTeamMembers((prev) => prev.filter((m) => !(m.team_id === teamId && m.user_id === user.id)));
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!supabase) return;
    const { error: err } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    if (err) { setError('Could not remove member.'); return; }
    setTeamMembers((prev) => prev.filter((m) => !(m.team_id === teamId && m.user_id === userId)));
  };

  // ---- Profile actions ----
  const handleSaveProfile = async (values: { displayName: string; gamerTag: string; bio: string }) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName, gamer_tag: values.gamerTag, bio: values.bio, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (err) { setError('Could not save your profile.'); return; }
  };

  const handleBecomeOrganizer = async () => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from('profiles').update({ role: 'organizer' }).eq('id', user.id);
    if (err) { setError('Could not update your role.'); return; }
    await loadData();
  };

  // ---- Render gates ----
  if (loading) {
    return <div className="app-shell"><main className="loading-state"><span className="section-kicker">LOADING</span><h2>Warming up the arena…</h2></main></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  const displayError = error || authError;
  const initials = (profile?.display_name || profile?.gamer_tag || user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('dashboard')} aria-label="Go to dashboard">
          <span className="brand-mark"><Swords size={18} strokeWidth={2.5} /></span>
          <span>bracket<span className="brand-dot">.</span>club</span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.view} className={view === item.view ? 'nav-link active' : 'nav-link'} onClick={() => setView(item.view)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="icon-button mobile-menu" onClick={() => setIsMenuOpen((open) => !open)} aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen}><Menu size={19} /></button>
          <button className="profile-button" onClick={() => setView('profile')} aria-label="Your profile">{initials}</button>
          <button className="icon-button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </header>

      <nav className={isMenuOpen ? 'mobile-nav open' : 'mobile-nav'} aria-label="Mobile navigation">
        {[...NAV_ITEMS, { view: 'profile' as View, label: 'Profile', icon: Users }].map((item) => (
          <button key={item.view} className={view === item.view ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => { setView(item.view); setIsMenuOpen(false); }}>
            {item.label} <ChevronRight size={15} />
          </button>
        ))}
      </nav>

      <main>
        {displayError && <div className="error-banner"><span>{displayError}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}

        {view === 'dashboard' && (
          <Dashboard
            tournaments={tournaments}
            matches={matches}
            registrations={registrations}
            myRegistrations={myRegistrations}
            onBrowse={() => setView('tournaments')}
            onRegister={(t) => { setSelectedTournamentId(t.id); setView('tournaments'); }}
            onGoMatches={() => setView('matches')}
          />
        )}

        {view === 'tournaments' && (
          <TournamentsView
            games={games}
            tournaments={tournaments}
            registrations={registrations}
            selectedId={selectedTournamentId}
            onSelect={setSelectedTournamentId}
            onCreateTournament={handleCreateTournament}
            onRegister={handleRegister}
            onCancelRegistration={handleCancelRegistration}
            onUpdateRegistrationStatus={handleUpdateRegistrationStatus}
            myTeams={myTeamsForRegister}
          />
        )}

        {view === 'matches' && (
          <MatchesView
            matches={matches}
            tournaments={tournaments}
            games={games}
            onCreateMatch={handleCreateMatch}
            onUpdateMatch={handleUpdateMatch}
          />
        )}

        {view === 'teams' && (
          <TeamsView
            games={games}
            teams={teams}
            membersByTeam={membersByTeam}
            onCreateTeam={handleCreateTeam}
            onJoinTeam={handleJoinTeam}
            onLeaveTeam={handleLeaveTeam}
            onRemoveMember={handleRemoveMember}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            myRegistrations={myRegistrations}
            myTeams={myTeams}
            membersByTeam={membersByTeam}
            onSaveProfile={handleSaveProfile}
            onBecomeOrganizer={handleBecomeOrganizer}
          />
        )}
      </main>

      <footer className="footer">
        <div className="brand footer-brand"><span className="brand-mark"><Swords size={17} /></span><span>bracket<span className="brand-dot">.</span>club</span></div>
        <span>Built for players who care about the game.</span>
        <span>© 2026 bracket.club</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
