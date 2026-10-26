import { FormEvent, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, Crown, Shield, Trophy, Users, X } from 'lucide-react';
import type { Registration, Team, TeamMember } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

type Props = {
  myRegistrations: Registration[];
  myTeams: Team[];
  membersByTeam: Record<string, TeamMember[]>;
  onSaveProfile: (values: { displayName: string; gamerTag: string; bio: string }) => Promise<void>;
  onBecomeOrganizer: () => Promise<void>;
};

export function ProfileView({ myRegistrations, myTeams, membersByTeam, onSaveProfile, onBecomeOrganizer }: Props) {
  const { user, profile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [gamerTag, setGamerTag] = useState(profile?.gamer_tag ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!profile) return null;

  const isOrganizer = profile.role === 'organizer' || profile.role === 'admin';
  const initials = (profile.display_name || profile.gamer_tag || user?.email || '?').slice(0, 2).toUpperCase();

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    await onSaveProfile({ displayName, gamerTag, bio });
    setBusy(false);
    setEditing(false);
  };

  return (
    <>
      <section className="content-section profile-section">
        <div className="profile-header">
          <span className="profile-avatar-lg">{initials}</span>
          <div className="profile-info">
            <span className="section-kicker">YOUR PROFILE</span>
            <h2>{profile.display_name || 'Player'}</h2>
            <p className="profile-tag">@{profile.gamer_tag || 'gamer'} · {user?.email}</p>
            <div className="profile-badges">
              <span className={`status-badge ${isOrganizer ? 'open' : ''}`}>{isOrganizer ? <><Crown size={12} /> Organizer</> : <><Users size={12} /> Player</>}</span>
              <span className="status-badge">Joined {formatDate(profile.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="profile-actions">
            {!editing && <button className="organizer-button" onClick={() => setEditing(true)}>Edit profile</button>}
            {!isOrganizer && <button className="text-button" onClick={() => void onBecomeOrganizer()}>Become organizer <ArrowUpRight size={15} /></button>}
            <button className="text-button danger" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>

        {editing && (
          <form className="profile-form" onSubmit={handleSave}>
            {error && <div className="auth-error"><X size={15} /> <span>{error}</span></div>}
            <label><span>Display name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
            <label><span>Gamer tag</span><input value={gamerTag} onChange={(e) => setGamerTag(e.target.value)} placeholder="e.g. NovaRift" /></label>
            <label><span>Bio</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell other players about yourself" /></label>
            <div className="profile-form-actions">
              <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}

        {!editing && profile.bio && <p className="profile-bio">{profile.bio}</p>}
      </section>

      <section className="content-section">
        <div className="section-heading"><div><span className="section-kicker">YOUR ACTIVITY</span><h2>My registrations</h2></div></div>
        {myRegistrations.length === 0 ? (
          <div className="empty-state"><Shield size={24} /><p>You haven't registered for any tournaments yet.</p></div>
        ) : (
          <div className="matches-list">
            {myRegistrations.map((reg) => (
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
        )}
      </section>

      <section className="content-section">
        <div className="section-heading"><div><span className="section-kicker">YOUR SQUADS</span><h2>My teams</h2></div></div>
        {myTeams.length === 0 ? (
          <div className="empty-state"><Users size={24} /><p>You're not on any teams yet.</p></div>
        ) : (
          <div className="team-grid">
            {myTeams.map((team) => {
              const members = membersByTeam[team.id] ?? [];
              const isCaptain = team.captain_id === user?.id;
              return (
                <article className="tournament-card" key={team.id}>
                  <div className="card-game-strip"><span className="game-icon"><Trophy size={18} /></span><span>{team.games?.name ?? 'Any game'}</span><span className="status-badge">{isCaptain ? 'Captain' : 'Member'}</span></div>
                  <div className="card-body"><h3>{team.name}</h3><p>{members.length} members</p></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
