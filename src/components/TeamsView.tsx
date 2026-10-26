import { useMemo, useState } from 'react';
import { Crown, Gamepad2, Plus, Shield, Users, X, Zap } from 'lucide-react';
import type { Game, Team, TeamMember } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatDate, slugify } from '@/lib/format';
import { FormModal } from './FormModal';

type Props = {
  games: Game[];
  teams: Team[];
  membersByTeam: Record<string, TeamMember[]>;
  onCreateTeam: (values: Record<string, string>) => Promise<void>;
  onJoinTeam: (teamId: string) => Promise<void>;
  onLeaveTeam: (teamId: string) => Promise<void>;
  onRemoveMember: (teamId: string, userId: string) => Promise<void>;
};

export function TeamsView({ games, teams, membersByTeam, onCreateTeam, onJoinTeam, onLeaveTeam, onRemoveMember }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [detailTeam, setDetailTeam] = useState<Team | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => !q || `${t.name} ${t.region} ${t.games?.name ?? ''}`.toLowerCase().includes(q));
  }, [query, teams]);

  return (
    <>
      <section className="content-section browse-section">
        <div className="section-heading">
          <div><span className="section-kicker">SQUAD UP</span><h2>Teams & rosters</h2></div>
          {user && <button className="organizer-button" onClick={() => setCreating(true)}><Plus size={16} /> Create team</button>}
        </div>

        <div className="browse-toolbar">
          <div className="search-box"><Users size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams" aria-label="Search teams" /></div>
        </div>

        <div className="team-grid">
          {filtered.map((team) => {
            const members = membersByTeam[team.id] ?? [];
            const isCaptain = team.captain_id === user?.id;
            const isMember = members.some((m) => m.user_id === user?.id);
            return (
              <article className="tournament-card" key={team.id}>
                <div className="card-game-strip">
                  <span className="game-icon"><Gamepad2 size={19} /></span>
                  <span>{team.games?.name ?? 'Any game'}</span>
                  <span className="status-badge">{team.region || 'Global'}</span>
                </div>
                <div className="card-body">
                  <span className="game-label">SQUAD</span>
                  <h3>{team.name}</h3>
                  <p className="team-desc">{team.description || 'A competitive squad looking for players.'}</p>
                  <div className="card-details"><span><Users size={14} /> {members.length} members</span><span><Crown size={14} /> Captain</span></div>
                  <div className="team-actions">
                    <button className="card-button" onClick={() => setDetailTeam(team)}>View roster <Shield size={14} /></button>
                    {!isMember && user && <button className="chip" onClick={() => onJoinTeam(team.id)}>Join</button>}
                    {isMember && !isCaptain && <button className="chip reject" onClick={() => onLeaveTeam(team.id)}>Leave</button>}
                    {isCaptain && <span className="status-badge open">Your team</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="empty-state"><Shield size={24} /><p>No teams found. Create the first one.</p></div>}
      </section>

      <FormModal
        open={creating}
        title="Create a team"
        subtitle="BUILD YOUR SQUAD"
        submitLabel="Create team"
        onClose={() => setCreating(false)}
        onSubmit={async (values) => { await onCreateTeam(values); setCreating(false); }}
        fields={[
          { name: 'name', label: 'Team name', required: true, placeholder: 'e.g. Neon Vanguard' },
          { name: 'gameName', label: 'Primary game', type: 'select', options: ['Any game', ...games.map((g) => g.name)] },
          { name: 'region', label: 'Region', placeholder: 'e.g. NA-East' },
          { name: 'description', label: 'Description', placeholder: 'What is your team about?' },
        ]}
      />

      {detailTeam && (
        <TeamDetailModal
          team={detailTeam}
          members={membersByTeam[detailTeam.id] ?? []}
          onClose={() => setDetailTeam(null)}
          onJoin={() => { void onJoinTeam(detailTeam.id); }}
          onLeave={() => { void onLeaveTeam(detailTeam.id); }}
          onRemove={(userId) => { void onRemoveMember(detailTeam.id, userId); }}
        />
      )}
    </>
  );
}

function TeamDetailModal({
  team,
  members,
  onClose,
  onJoin,
  onLeave,
  onRemove,
}: {
  team: Team;
  members: TeamMember[];
  onClose: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onRemove: (userId: string) => void;
}) {
  const { user } = useAuth();
  const isCaptain = team.captain_id === user?.id;
  const isMember = members.some((m) => m.user_id === user?.id);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <span className="section-kicker">{team.games?.name ?? 'Any game'} · {team.region || 'Global'}</span>
        <h2>{team.name}</h2>
        <p>{team.description || 'A competitive squad looking for players.'}</p>
        <div className="detail-dates"><span>Founded {formatDate(team.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>

        <div className="detail-roster">
          <span className="mini-heading">ROSTER ({members.length})</span>
          {members.length === 0 && <p className="roster-empty">No members listed yet.</p>}
          {members.map((member) => (
            <div className="roster-row" key={member.id}>
              <span className="roster-name">{member.profiles?.display_name || member.profiles?.gamer_tag || 'Player'}</span>
              {member.role === 'captain' && <span className="status-badge open"><Crown size={11} /> Captain</span>}
              <span className="roster-type">@{member.profiles?.gamer_tag || 'player'}</span>
              <div className="roster-actions">
                {isCaptain && member.role !== 'captain' && <button className="chip reject" onClick={() => onRemove(member.user_id)}>Remove</button>}
              </div>
            </div>
          ))}
        </div>

        {user && !isMember && <button className="primary-button full-width" onClick={onJoin}>Join team <Zap size={16} /></button>}
        {isMember && !isCaptain && <button className="text-button danger" onClick={onLeave}>Leave team</button>}
        {isCaptain && <small className="modal-note"><Crown size={14} /> You are the captain of this team.</small>}
        {!user && <small className="modal-note">Sign in to join a team.</small>}
      </div>
    </div>
  );
}
