import { FormEvent, useState } from 'react';
import { ArrowUpRight, Swords, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'signup';

export function AuthScreen({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const { signIn, signUp, error, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const displayedError = localError || error;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setLocalError('');
    clearError();
    if (mode === 'signup') {
      const { error: err } = await signUp(email, password, name);
      if (err) setLocalError(err);
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setLocalError(err);
    }
    setBusy(false);
  };

  return (
    <div className="app-shell">
      <main className="auth-shell">
        <div className="auth-card">
          <button className="brand" aria-label="bracket.club">
            <span className="brand-mark"><Swords size={18} strokeWidth={2.5} /></span>
            <span>bracket<span className="brand-dot">.</span>club</span>
          </button>
          <span className="section-kicker">{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span>
          <h2 className="auth-title">{mode === 'signup' ? 'Join the arena.' : 'Sign in to compete.'}</h2>
          <p className="auth-sub">
            {mode === 'signup'
              ? 'Create an account to register for tournaments, build teams, and track your matches.'
              : 'Pick up right where you left off.'}
          </p>

          {displayedError && (
            <div className="auth-error"><X size={15} /> <span>{displayedError}</span></div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label>
                <span>Display name</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NovaRift"
                />
              </label>
            )}
            <label>
              <span>Email</span>
              <input
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            <button className="primary-button full-width" type="submit" disabled={busy}>
              {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowUpRight size={17} />
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'signup' ? (
              <>Already have an account? <button onClick={() => setMode('signin')}>Sign in</button></>
            ) : (
              <>New here? <button onClick={() => setMode('signup')}>Create an account</button></>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
