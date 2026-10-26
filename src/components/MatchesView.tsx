import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Shield, Trophy, X, Zap } from 'lucide-react';
import type { Game, Match, Tournament } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import { FormModal } from './FormModal';

type Props = {
  matches: Match[];
  tournaments: Tournament[];
  games: Game[];
  onCreateMatch: (values: Record<string, string>) => Promise<void>;
  onUpdateMatch: (matchId: string, values: { status: Match['status']; scoreOne: number; scoreTwo: number; winner: string | null }) => Promise<void>;
};

export function MatchesView({ matches, tournaments, games, onCreateMatch, onUpdateMatch }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'All' | Match['status']>('All');
  const [editing, setEditing] = useState<Match | null>(null);
  const [creating, setCreating] = useState(false);

  const myTournaments = tournaments.filter((t) => t.organizer_id === user?.id);

  const filtered = useMemo(() => {
    const sorted = [...matches].sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
    return filter === 'All' ? sorted : sorted.filter((m) => m.status === filter);
  }, [matches, filter]);

  return (
    <>
      <section className="content-section browse-section">
        <div className="section-heading">
          <div><span className="section-kicker">LIVE MATCH CENTER</span><h2>Match schedule & results</h2></div>
          {myTournaments.length > 0 && (
            <button className="organizer-button" onClick={() => setCreating(true)}><Plus size={16} /> Schedule match</button>
          )}
        </div>

        <div className="browse-toolbar">
          <div className="game-filters">
            {(['All', 'Scheduled', 'Live', 'Completed', 'Cancelled'] as const).map((f) => (
              <button key={f} className={filter === f ? 'filter active' : 'filter'} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="matches-list">
          {filtered.map((match) => {
            const tournament = tournaments.find((t) => t.id === match.tournament_id);
            const isOrganizer = tournament?.organizer_id === user?.id;
            return (
              <article className="match-card" key={match.id}>
                <div className="match-context">
                  <span className={`match-status ${match.status.toLowerCase()}`}>{match.status === 'Live' && <i />} {match.status}</span>
                  <small>{tournament?.title ?? match.tournaments?.title} · {match.round_name}</small>
                </div>
                <div className="match-teams">
                  <span className={match.winner === match.participant_one ? 'winner' : ''}>{match.participant_one}</span>
                  <b>{match.score_one} — {match.score_two}</b>
                  <span className={match.winner === match.participant_two ? 'winner' : ''}>{match.participant_two}</span>
                </div>
                <div className="match-time">
                  <CalendarDays size={15} /> {formatDate(match.scheduled_time)} at {formatTime(match.scheduled_time)}
                  {isOrganizer && <button className="chip" onClick={() => setEditing(match)}>Edit</button>}
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="empty-state"><Shield size={24} /><p>No matches in this view.</p></div>}
      </section>

      <FormModal
        open={creating}
        title="Schedule a match"
        subtitle="ORGANIZER TOOLS"
        submitLabel="Add to schedule"
        onClose={() => setCreating(false)}
        onSubmit={async (values) => { await onCreateMatch(values); setCreating(false); }}
        fields={[
          { name: 'tournamentTitle', label: 'Tournament', type: 'select', options: myTournaments.map((t) => t.title) },
          { name: 'roundName', label: 'Round name', required: true, placeholder: 'e.g. Quarterfinals' },
          { name: 'participantOne', label: 'Participant one', required: true, placeholder: 'e.g. Pixel Pioneers' },
          { name: 'participantTwo', label: 'Participant two', required: true, placeholder: 'e.g. Orbit Five' },
          { name: 'scheduledTime', label: 'Scheduled time', type: 'datetime-local', required: true },
        ]}
      />

      {editing && (
        <EditMatchModal
          match={editing}
          games={games}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => { await onUpdateMatch(editing.id, values); setEditing(null); }}
        />
      )}
    </>
  );
}

function EditMatchModal({
  match,
  onClose,
  onSubmit,
}: {
  match: Match;
  games: Game[];
  onClose: () => void;
  onSubmit: (values: { status: Match['status']; scoreOne: number; scoreTwo: number; winner: string | null }) => Promise<void>;
}) {
  const [status, setStatus] = useState<Match['status']>(match.status);
  const [scoreOne, setScoreOne] = useState(match.score_one);
  const [scoreTwo, setScoreTwo] = useState(match.score_two);

  const winner = scoreOne > scoreTwo ? match.participant_one : scoreTwo > scoreOne ? match.participant_two : null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="section-kicker">{match.round_name} · Match #{match.match_number}</span>
        <h2>Update result</h2>
        <p>{match.participant_one} vs {match.participant_two}</p>
        <form onSubmit={async (e) => { e.preventDefault(); await onSubmit({ status, scoreOne, scoreTwo, winner }); }}>
          <label><span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Match['status'])}>
              <option>Scheduled</option><option>Live</option><option>Completed</option><option>Cancelled</option>
            </select>
          </label>
          <div className="score-row">
            <label><span>{match.participant_one} score</span><input type="number" min="0" value={scoreOne} onChange={(e) => setScoreOne(Number(e.target.value))} /></label>
            <label><span>{match.participant_two} score</span><input type="number" min="0" value={scoreTwo} onChange={(e) => setScoreTwo(Number(e.target.value))} /></label>
          </div>
          {winner && status === 'Completed' && <div className="winner-note"><Trophy size={15} /> Winner: {winner}</div>}
          <button className="primary-button full-width" type="submit">Save result</button>
        </form>
      </div>
    </div>
  );
}
