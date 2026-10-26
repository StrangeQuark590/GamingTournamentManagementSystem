import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Gamepad2,
  LayoutGrid,
  Menu,
  Search,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type Game = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  platform: string;
  accent: string;
};

type Tournament = {
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
  status: 'Upcoming' | 'Open' | 'Ongoing' | 'Completed' | 'Cancelled';
  description: string;
  games?: Game;
};

type Registration = {
  id: string;
  tournament_id: string;
  entrant_name: string;
  email: string;
  entry_type: 'Solo' | 'Team';
  status: string;
};

type Match = {
  id: string;
  tournament_id: string;
  round_name: string;
  match_number: number;
  participant_one: string;
  participant_two: string;
  scheduled_time: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  score_one: number;
  score_two: number;
  tournaments?: { title: string; slug: string };
};

type View = 'overview' | 'tournaments' | 'matches';

const formatMoney = (value: number) => `$${value.toLocaleString('en-US')}`;
const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric' }).format(new Date(value));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

function App() {
  const [view, setView] = useState<View>('overview');
  const [games, setGames] = useState<Game[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [query, setQuery] = useState('');
  const [activeGame, setActiveGame] = useState('All games');
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (!isSupabaseConfigured || !supabase) {
        setError('Tournament data is not connected in this deployment yet. Add the Supabase settings to your GitHub Pages build.');
        setIsLoading(false);
        return;
      }
      const [gamesResult, tournamentsResult, registrationsResult, matchesResult] = await Promise.all([
        supabase.from('games').select('*').order('name'),
        supabase.from('tournaments').select('*, games(*)').order('start_date'),
        supabase.from('registrations').select('*'),
        supabase.from('matches').select('*, tournaments(title, slug)').order('scheduled_time'),
      ]);

      const firstError = gamesResult.error ?? tournamentsResult.error ?? registrationsResult.error ?? matchesResult.error;
      if (firstError) {
        setError('We could not load the tournament board right now. Please refresh and try again.');
      } else {
        setGames(gamesResult.data ?? []);
        setTournaments((tournamentsResult.data as Tournament[]) ?? []);
        setRegistrations(registrationsResult.data ?? []);
        setMatches((matchesResult.data as Match[]) ?? []);
      }
      setIsLoading(false);
    };

    void loadData();
  }, []);

  const openTournaments = tournaments.filter((tournament) => tournament.status === 'Open' || tournament.status === 'Upcoming');
  const liveMatches = matches.filter((match) => match.status === 'Live');
  const activeTournament = tournaments.find((tournament) => tournament.status === 'Ongoing') ?? tournaments[0];
  const totalPrizePool = tournaments.reduce((sum, tournament) => sum + Number(tournament.prize_pool), 0);

  const filteredTournaments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tournaments.filter((tournament) => {
      const matchesGame = activeGame === 'All games' || tournament.games?.name === activeGame;
      const matchesQuery = !normalizedQuery || `${tournament.title} ${tournament.format} ${tournament.games?.name}`.toLowerCase().includes(normalizedQuery);
      return matchesGame && matchesQuery;
    });
  }, [activeGame, query, tournaments]);

  const openRegistration = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setIsRegistering(true);
  };

  const handleRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTournament || !supabase) return;
    const formData = new FormData(event.currentTarget);
    const entrantName = String(formData.get('entrantName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const entryType = String(formData.get('entryType') ?? 'Solo') as 'Solo' | 'Team';
    const { error: insertError } = await supabase.from('registrations').insert({
      tournament_id: selectedTournament.id,
      entrant_name: entrantName,
      email,
      entry_type: entryType,
    });

    if (insertError) {
      setError(insertError.code === '23505' ? 'That email is already registered for this tournament.' : 'Registration could not be completed. Please try again.');
      return;
    }

    setRegistrations((current) => [...current, { id: crypto.randomUUID(), tournament_id: selectedTournament.id, entrant_name: entrantName, email, entry_type: entryType, status: 'Pending' }]);
    setIsRegistering(false);
    setSelectedTournament(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('overview')} aria-label="Go to dashboard">
          <span className="brand-mark"><Swords size={18} strokeWidth={2.5} /></span>
          <span>bracket<span className="brand-dot">.</span>club</span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {(['overview', 'tournaments', 'matches'] as View[]).map((item) => (
            <button key={item} className={view === item ? 'nav-link active' : 'nav-link'} onClick={() => setView(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="icon-button mobile-menu" onClick={() => setIsMenuOpen((open) => !open)} aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen}><Menu size={19} /></button>
          <button className="organizer-button" onClick={() => setView('tournaments')}><LayoutGrid size={16} /> Organizer view</button>
          <button className="profile-button" aria-label="Your profile">PC</button>
        </div>
      </header>
      <nav className={isMenuOpen ? 'mobile-nav open' : 'mobile-nav'} aria-label="Mobile navigation">
        {(['overview', 'tournaments', 'matches'] as View[]).map((item) => (
          <button key={item} className={view === item ? 'mobile-nav-link active' : 'mobile-nav-link'} onClick={() => { setView(item); setIsMenuOpen(false); }}>
            {item[0].toUpperCase() + item.slice(1)} <ChevronRight size={15} />
          </button>
        ))}
      </nav>

      <main>
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-pip" /> THE COMPETITIVE HOME FOR EVERYONE</div>
            <h1>Find your next<br /><em>legendary</em> match.</h1>
            <p>Discover tournaments, build your squad, and prove what you can do. No noise. Just good games and better competition.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setView('tournaments')}>Explore tournaments <ArrowUpRight size={17} /></button>
              <button className="text-button" onClick={() => openTournaments[0] && openRegistration(openTournaments[0])}>Join the next event <ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="grid-lines" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-badge badge-top"><span className="badge-icon"><Zap size={16} /></span><span><strong>2,480+</strong><small>active competitors</small></span></div>
            <div className="hero-badge badge-bottom"><span className="mini-avatars"><i>R</i><i>N</i><i>V</i></span><span><strong>Good energy only</strong><small>12 events happening today</small></span></div>
            <div className="hero-emblem"><Trophy size={42} strokeWidth={1.3} /><span>PLAY<br /><b>LOUD</b></span></div>
          </div>
        </section>

        <section className="stats-row" aria-label="Community statistics">
          <div><span className="stat-label">Active tournaments</span><strong>{isLoading ? '—' : openTournaments.length.toString().padStart(2, '0')}</strong><span className="stat-change">+18% this month</span></div>
          <div><span className="stat-label">Community players</span><strong>2,480</strong><span className="stat-change">+240 this week</span></div>
          <div><span className="stat-label">Prize money live</span><strong>{formatMoney(totalPrizePool)}</strong><span className="stat-change">Across all events</span></div>
          <div><span className="stat-label">Matches today</span><strong>{matches.length.toString().padStart(2, '0')}</strong><span className="stat-change">{liveMatches.length} live right now</span></div>
        </section>

        <section className="content-section spotlight-section">
          <div className="section-heading"><div><span className="section-kicker">CURATED FOR YOU</span><h2>In the spotlight</h2></div><button className="link-button" onClick={() => setView('tournaments')}>View all tournaments <ArrowUpRight size={16} /></button></div>
          <div className="spotlight-grid">
            {activeTournament && <article className="feature-card">
              <div className="feature-top"><span className="status-badge live"><CircleDot size={13} /> {activeTournament.status}</span><span className="feature-date">{formatDate(activeTournament.start_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
              <div className="feature-content"><span className="game-label">{activeTournament.games?.name} <span>·</span> {activeTournament.games?.genre}</span><h3>{activeTournament.title}</h3><p>{activeTournament.description}</p><div className="feature-meta"><span><Trophy size={15} /> {formatMoney(Number(activeTournament.prize_pool))} prize pool</span><span><Users size={15} /> {registrations.filter((registration) => registration.tournament_id === activeTournament.id).length}/{activeTournament.max_participants} registered</span></div></div>
              <button className="feature-cta" onClick={() => openRegistration(activeTournament)}>View tournament <ArrowUpRight size={17} /></button>
            </article>}
            <div className="side-events">
              <div className="mini-heading"><span>UP NEXT</span><Clock3 size={15} /></div>
              {openTournaments.slice(0, 3).map((tournament) => <button className="event-row" key={tournament.id} onClick={() => openRegistration(tournament)}><span className={`game-icon ${tournament.games?.accent ?? 'cyan'}`}><Gamepad2 size={17} /></span><span className="event-info"><strong>{tournament.title}</strong><small>{tournament.games?.name} · {tournament.format.split('·')[0].trim()}</small></span><span className="event-date">{formatDate(tournament.start_date)}<ChevronRight size={16} /></span></button>)}
            </div>
          </div>
        </section>

        <section className="content-section browse-section">
          <div className="section-heading"><div><span className="section-kicker">MAKE YOUR MOVE</span><h2>{view === 'matches' ? 'Live match center' : 'Browse the board'}</h2></div><div className="view-switcher"><button className={view === 'tournaments' || view === 'overview' ? 'switch active' : 'switch'} onClick={() => setView('tournaments')}>Tournaments</button><button className={view === 'matches' ? 'switch active' : 'switch'} onClick={() => setView('matches')}>Match center</button></div></div>
          {view === 'matches' ? <div className="matches-list">{matches.map((match) => <article className="match-card" key={match.id}><div className="match-context"><span className={`match-status ${match.status.toLowerCase()}`}>{match.status === 'Live' && <i />} {match.status}</span><small>{match.tournaments?.title} · {match.round_name}</small></div><div className="match-teams"><span>{match.participant_one}</span><b>{match.score_one} — {match.score_two}</b><span>{match.participant_two}</span></div><div className="match-time"><CalendarDays size={15} /> {formatDate(match.scheduled_time)} at {formatTime(match.scheduled_time)}</div></article>)}</div> : <>
            <div className="browse-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tournaments" aria-label="Search tournaments" /></div><div className="game-filters"><button className={activeGame === 'All games' ? 'filter active' : 'filter'} onClick={() => setActiveGame('All games')}>All games</button>{games.map((game) => <button key={game.id} className={activeGame === game.name ? 'filter active' : 'filter'} onClick={() => setActiveGame(game.name)}>{game.name}</button>)}</div></div>
            <div className="tournament-grid">{filteredTournaments.map((tournament) => <article className="tournament-card" key={tournament.id}><div className={`card-game-strip ${tournament.games?.accent ?? 'cyan'}`}><span className="game-icon"><Gamepad2 size={19} /></span><span>{tournament.games?.name}</span><span className={`status-badge ${tournament.status.toLowerCase()}`}>{tournament.status}</span></div><div className="card-body"><span className="game-label">{tournament.format}</span><h3>{tournament.title}</h3><p>{formatDate(tournament.start_date, { month: 'short', day: 'numeric', year: 'numeric' })} · {formatTime(tournament.start_date)}</p><div className="card-details"><span><Trophy size={14} /> {formatMoney(Number(tournament.prize_pool))}</span><span><Users size={14} /> {tournament.max_participants} slots</span></div><button className="card-button" onClick={() => openRegistration(tournament)} disabled={tournament.status === 'Completed' || tournament.status === 'Cancelled'}>{tournament.status === 'Open' ? 'Register now' : 'View details'} <ArrowUpRight size={16} /></button></div></article>)}</div>
            {!isLoading && filteredTournaments.length === 0 && <div className="empty-state"><Shield size={24} /><p>No tournaments match that search yet.</p></div>}
          </>}
        </section>
      </main>

      <footer className="footer"><div className="brand footer-brand"><span className="brand-mark"><Swords size={17} /></span><span>bracket<span className="brand-dot">.</span>club</span></div><span>Built for players who care about the game.</span><span>© 2026 bracket.club</span></footer>

      {isRegistering && selectedTournament && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsRegistering(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><button className="modal-close" onClick={() => setIsRegistering(false)} aria-label="Close registration"><X size={18} /></button><span className="section-kicker">{selectedTournament.games?.name} · {selectedTournament.format}</span><h2 id="register-title">Claim your slot.</h2><p>Join <strong>{selectedTournament.title}</strong>. We will send your confirmation to the email below.</p><form onSubmit={handleRegistration}><label>Player or team name<input name="entrantName" required placeholder="e.g. Pixel Pioneers" /></label><label>Email address<input name="email" required type="email" placeholder="you@example.com" /></label><label>Entry type<select name="entryType" defaultValue="Solo"><option>Solo</option><option>Team</option></select></label><button className="primary-button full-width" type="submit">Submit registration <ArrowUpRight size={17} /></button></form><small className="modal-note"><Check size={14} /> Your entry will be marked pending until the organizer approves it.</small></div></div>}
    </div>
  );
}

export default App;
