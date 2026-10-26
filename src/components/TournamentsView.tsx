import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Gamepad2, Plus, Search, Shield, Trophy, Users, X } from 'lucide-react';
import type { Game, Registration, Tournament } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { FormModal } from './FormModal';

type Props = {
  games: Game[];
  tournaments: Tournament[];
  registrations: Registration[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateTournament: (values: Record<string, string>) => Promise<void>;
  onRegister: (tournament: Tournament, values: { entrantName: string; email: string; entryType: 'Solo' | 'Team'; teamId?: string | null }) => Promise<void>;
  onCancelRegistration: (registrationId: string) => Promise<void>;
  onUpdateRegistrationStatus: (registrationId: string, status: 'Approved' | 'Rejected') => Promise<void>;
  myTeams: { id: string; name: string }[];
};

export function TournamentsView({
  games,
  tournaments,
  registrations,
  selectedId,
  onSelect,
  onCreateTournament,
  onRegister,
  onCancelRegistration,
  onUpdateRegistrationStatus,
  myTeams,
}: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeGame, setActiveGame] = useState('All games');
  const [creating, setCreating] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<Tournament | null>(null);

  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournaments.filter((t) => {
      const matchGame = activeGame === 'All games' || t.games?.name === activeGame;
      const matchQuery = !q || `${t.title} ${t.format} ${t.games?.name}`.toLowerCase().includes(q);
      return matchGame && matchQuery;
    });
  }, [activeGame, query, tournaments]);

  return (
    <>
      <section className="content-section browse-section">
        <div className="section-heading">
          <div><span className="section-kicker">MAKE YOUR MOVE</span><h2>Browse the board</h2></div>
          {user && (
            <button className="organizer-button" onClick={() => setCreating(true)}><Plus size={16} /> Host a tournament</button>
          )}
        </div>

        <div className="browse-toolbar">
          <div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tournaments" aria-label="Search tournaments" /></div>
          <div className="game-filters">
            <button className={activeGame === 'All games' ? 'filter active' : 'filter'} onClick={() => setActiveGame('All games')}>All games</button>
            {games.map((game) => <button key={game.id} className={activeGame === game.name ? 'filter active' : 'filter'} onClick={() => setActiveGame(game.name)}>{game.name}</button>)}
          </div>
        </div>

        <div className="tournament-grid">
          {filtered.map((tournament) => (
            <article className="tournament-card" key={tournament.id}>
              <div className={`card-game-strip ${tournament.games?.accent ?? 'cyan'}`}>
                <span className="game-icon"><Gamepad2 size={19} /></span>
                <span>{tournament.games?.name}</span>
                <span className={`status-badge ${tournament.status.toLowerCase()}`}>{tournament.status}</span>
              </div>
              <div className="card-body">
                <span className="game-label">{tournament.format}</span>
                <h3>{tournament.title}</h3>
                <p>{formatDate(tournament.start_date, { month: 'short', day: 'numeric', year: 'numeric' })} · {formatTime(tournament.start_date)}</p>
                <div className="card-details"><span><Trophy size={14} /> {formatMoney(Number(tournament.prize_pool))}</span><span><Users size={14} /> {tournament.max_participants} slots</span></div>
                <button className="card-button" onClick={() => onSelect(tournament.id)} disabled={tournament.status === 'Cancelled'}>View details <ArrowUpRight size={16} /></button>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div className="empty-state"><Shield size={24} /><p>No tournaments match that search yet.</p></div>}
      </section>

      {selected && (
        <TournamentDetail
          tournament={selected}
          registrations={registrations.filter((r) => r.tournament_id === selected.id)}
          onClose={() => onSelect(null)}
          onRegister={(t) => setRegisterTarget(t)}
          onCancelRegistration={onCancelRegistration}
          onUpdateRegistrationStatus={onUpdateRegistrationStatus}
        />
      )}

      <FormModal
        open={creating}
        title="Host a tournament"
        subtitle="ORGANIZER TOOLS"
        submitLabel="Publish tournament"
        onClose={() => setCreating(false)}
        onSubmit={async (values) => { await onCreateTournament(values); setCreating(false); }}
        fields={[
          { name: 'title', label: 'Tournament title', required: true, placeholder: 'e.g. Spring Showdown' },
          { name: 'gameName', label: 'Game', type: 'select', options: games.map((g) => g.name) },
          { name: 'format', label: 'Format', required: true, placeholder: 'e.g. 5v5 · Single elimination' },
          { name: 'startDate', label: 'Start date & time', type: 'datetime-local', required: true },
          { name: 'registrationDeadline', label: 'Registration deadline', type: 'datetime-local', required: true },
          { name: 'entryFee', label: 'Entry fee ($)', type: 'number', min: '0', step: '1', defaultValue: '0' },
          { name: 'prizePool', label: 'Prize pool ($)', type: 'number', min: '0', step: '1', defaultValue: '0' },
          { name: 'maxParticipants', label: 'Max participants', type: 'number', min: '1', step: '1', defaultValue: '32' },
          { name: 'description', label: 'Description', required: true, placeholder: 'What makes this event special?' },
        ]}
      />

      <RegisterModal
        tournament={registerTarget}
        myTeams={myTeams}
        onClose={() => setRegisterTarget(null)}
        onSubmit={async (values) => {
          if (registerTarget) await onRegister(registerTarget, values);
          setRegisterTarget(null);
        }}
      />
    </>
  );
}

function TournamentDetail({
  tournament,
  registrations,
  onClose,
  onRegister,
  onCancelRegistration,
  onUpdateRegistrationStatus,
}: {
  tournament: Tournament;
  registrations: Registration[];
  onClose: () => void;
  onRegister: (tournament: Tournament) => void;
  onCancelRegistration: (registrationId: string) => Promise<void>;
  onUpdateRegistrationStatus: (registrationId: string, status: 'Approved' | 'Rejected') => Promise<void>;
}) {
  const { user, profile } = useAuth();
  const isOrganizer = tournament.organizer_id === user?.id;
  const myReg = registrations.find((r) => r.user_id === user?.id);
  const canRegister = tournament.status === 'Open' && !myReg && !isOrganizer;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="section-kicker">{tournament.games?.name} · {tournament.format}</span>
        <h2>{tournament.title}</h2>
        <p className="detail-desc">{tournament.description}</p>

        <div className="detail-stats">
          <div><span className="stat-label">Prize pool</span><strong>{formatMoney(Number(tournament.prize_pool))}</strong></div>
          <div><span className="stat-label">Entry fee</span><strong>{formatMoney(Number(tournament.entry_fee))}</strong></div>
          <div><span className="stat-label">Capacity</span><strong>{registrations.length}/{tournament.max_participants}</strong></div>
          <div><span className="stat-label">Status</span><strong>{tournament.status}</strong></div>
        </div>

        <div className="detail-dates">
          <span><CalendarDays size={15} /> Starts {formatDate(tournament.start_date, { month: 'short', day: 'numeric', year: 'numeric' })} at {formatTime(tournament.start_date)}</span>
          <span>Registration closes {formatDate(tournament.registration_deadline, { month: 'short', day: 'numeric' })}</span>
        </div>

        {canRegister && <button className="primary-button full-width" onClick={() => onRegister(tournament)}>Register now <ArrowUpRight size={17} /></button>}
        {myReg && (
          <div className="detail-myreg">
            <span className={`status-badge ${myReg.status.toLowerCase()}`}>Your entry: {myReg.status}</span>
            {myReg.status !== 'Cancelled' && <button className="text-button danger" onClick={() => onCancelRegistration(myReg.id)}>Cancel entry</button>}
          </div>
        )}

        {isOrganizer && registrations.length > 0 && (
          <div className="detail-roster">
            <span className="mini-heading">REGISTRATIONS ({registrations.length})</span>
            {registrations.map((reg) => (
              <div className="roster-row" key={reg.id}>
                <span className="roster-name">{reg.entrant_name}</span>
                <span className="roster-type">{reg.entry_type}</span>
                <span className={`status-badge ${reg.status.toLowerCase()}`}>{reg.status}</span>
                <div className="roster-actions">
                  {reg.status === 'Pending' && (
                    <>
                      <button className="chip approve" onClick={() => onUpdateRegistrationStatus(reg.id, 'Approved')}>Approve</button>
                      <button className="chip reject" onClick={() => onUpdateRegistrationStatus(reg.id, 'Rejected')}>Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!user && <small className="modal-note"><Shield size={14} /> Sign in to register for this tournament.</small>}
        {user && !canRegister && !myReg && !isOrganizer && (
          <small className="modal-note">Registration is {tournament.status.toLowerCase() !== 'open' ? 'closed for this event' : 'not available'}.</small>
        )}
      </div>
    </div>
  );
}

function RegisterModal({
  tournament,
  myTeams,
  onClose,
  onSubmit,
}: {
  tournament: Tournament | null;
  myTeams: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (values: { entrantName: string; email: string; entryType: 'Solo' | 'Team'; teamId?: string | null }) => Promise<void>;
}) {
  const { user } = useAuth();
  if (!tournament) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="section-kicker">{tournament.games?.name} · {tournament.format}</span>
        <h2>Claim your slot.</h2>
        <p>Join <strong>{tournament.title}</strong>.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          await onSubmit({
            entrantName: String(data.get('entrantName') ?? '').trim(),
            email: String(data.get('email') ?? '').trim(),
            entryType: String(data.get('entryType')) as 'Solo' | 'Team',
            teamId: data.get('teamId') ? String(data.get('teamId')) : null,
          });
        }}>
          <label>Player or team name<input name="entrantName" required placeholder="e.g. Pixel Pioneers" /></label>
          <label>Email address<input name="email" required type="email" defaultValue={user?.email ?? ''} placeholder="you@example.com" /></label>
          <label>Entry type<select name="entryType" defaultValue="Solo"><option>Solo</option><option>Team</option></select></label>
          {myTeams.length > 0 && (
            <label>Team (optional)<select name="teamId" defaultValue=""><option value="">No team</option>{myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          )}
          <button className="primary-button full-width" type="submit">Submit registration <ArrowUpRight size={17} /></button>
        </form>
        <small className="modal-note">Your entry will be marked pending until the organizer approves it.</small>
      </div>
    </div>
  );
}
