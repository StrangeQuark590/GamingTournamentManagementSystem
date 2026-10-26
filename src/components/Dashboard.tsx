import { ArrowUpRight, CalendarDays, ChevronRight, CircleDot, Clock3, Gamepad2, Trophy, Users, Zap } from 'lucide-react';
import type { Match, Registration, Tournament } from '@/lib/types';
import { formatDate, formatMoney, formatTime } from '@/lib/format';

type Props = {
  tournaments: Tournament[];
  matches: Match[];
  registrations: Registration[];
  myRegistrations: Registration[];
  onBrowse: () => void;
  onRegister: (tournament: Tournament) => void;
  onGoMatches: () => void;
};

export function Dashboard({ tournaments, matches, registrations, myRegistrations, onBrowse, onRegister, onGoMatches }: Props) {
  const openTournaments = tournaments.filter((t) => t.status === 'Open' || t.status === 'Upcoming');
  const liveMatches = matches.filter((m) => m.status === 'Live');
  const activeTournament = tournaments.find((t) => t.status === 'Ongoing') ?? tournaments[0];
  const totalPrizePool = tournaments.reduce((sum, t) => sum + Number(t.prize_pool), 0);

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-pip" /> THE COMPETITIVE HOME FOR EVERYONE</div>
          <h1>Find your next<br /><em>legendary</em> match.</h1>
          <p>Discover tournaments, build your squad, and prove what you can do. No noise. Just good games and better competition.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onBrowse}>Explore tournaments <ArrowUpRight size={17} /></button>
            <button className="text-button" onClick={() => openTournaments[0] && onRegister(openTournaments[0])}>Join the next event <ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="grid-lines" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-badge badge-top"><span className="badge-icon"><Zap size={16} /></span><span><strong>2,480+</strong><small>active competitors</small></span></div>
          <div className="hero-badge badge-bottom"><span className="mini-avatars"><i>R</i><i>N</i><i>V</i></span><span><strong>Good energy only</strong><small>{liveMatches.length} live right now</small></span></div>
          <div className="hero-emblem"><Trophy size={42} strokeWidth={1.3} /><span>PLAY<br /><b>LOUD</b></span></div>
        </div>
      </section>

      {myRegistrations.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR BRACKET</span><h2>Your registrations</h2></div>
          </div>
          <div className="matches-list">
            {myRegistrations.slice(0, 3).map((reg) => (
              <article className="match-card" key={reg.id}>
                <div className="match-context">
                  <span className={`match-status ${reg.status.toLowerCase()}`}>{reg.status}</span>
                  <small>{reg.tournaments?.title ?? 'Tournament'} · {reg.entry_type}</small>
                </div>
                <div className="match-teams"><span>{reg.entrant_name}</span><b>{reg.status === 'Approved' ? 'IN' : '…'}</b><span>{reg.entry_type}</span></div>
                <div className="match-time"><CalendarDays size={15} /> Registered {formatDate(reg.registered_at)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="stats-row" aria-label="Community statistics">
        <div><span className="stat-label">Active tournaments</span><strong>{openTournaments.length.toString().padStart(2, '0')}</strong><span className="stat-change">+18% this month</span></div>
        <div><span className="stat-label">Community players</span><strong>2,480</strong><span className="stat-change">+240 this week</span></div>
        <div><span className="stat-label">Prize money live</span><strong>{formatMoney(totalPrizePool)}</strong><span className="stat-change">Across all events</span></div>
        <div><span className="stat-label">Matches scheduled</span><strong>{matches.length.toString().padStart(2, '0')}</strong><span className="stat-change">{liveMatches.length} live right now</span></div>
      </section>

      <section className="content-section spotlight-section">
        <div className="section-heading"><div><span className="section-kicker">CURATED FOR YOU</span><h2>In the spotlight</h2></div><button className="link-button" onClick={onBrowse}>View all tournaments <ArrowUpRight size={16} /></button></div>
        <div className="spotlight-grid">
          {activeTournament && (
            <article className="feature-card">
              <div className="feature-top"><span className="status-badge live"><CircleDot size={13} /> {activeTournament.status}</span><span className="feature-date">{formatDate(activeTournament.start_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
              <div className="feature-content"><span className="game-label">{activeTournament.games?.name} <span>·</span> {activeTournament.games?.genre}</span><h3>{activeTournament.title}</h3><p>{activeTournament.description}</p><div className="feature-meta"><span><Trophy size={15} /> {formatMoney(Number(activeTournament.prize_pool))} prize pool</span><span><Users size={15} /> {registrations.filter((r) => r.tournament_id === activeTournament.id).length}/{activeTournament.max_participants} registered</span></div></div>
              <button className="feature-cta" onClick={() => onRegister(activeTournament)}>View tournament <ArrowUpRight size={17} /></button>
            </article>
          )}
          <div className="side-events">
            <div className="mini-heading"><span>UP NEXT</span><Clock3 size={15} /></div>
            {openTournaments.slice(0, 4).map((tournament) => (
              <button className="event-row" key={tournament.id} onClick={() => onRegister(tournament)}>
                <span className={`game-icon ${tournament.games?.accent ?? 'cyan'}`}><Gamepad2 size={17} /></span>
                <span className="event-info"><strong>{tournament.title}</strong><small>{tournament.games?.name} · {tournament.format.split('·')[0].trim()}</small></span>
                <span className="event-date">{formatDate(tournament.start_date)}<ChevronRight size={16} /></span>
              </button>
            ))}
            {liveMatches.length > 0 && (
              <button className="event-row" onClick={onGoMatches}>
                <span className="game-icon red"><Zap size={17} /></span>
                <span className="event-info"><strong>{liveMatches.length} matches live now</strong><small>Tap to follow results</small></span>
                <span className="event-date">LIVE<ChevronRight size={16} /></span>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
