import { useEffect, useRef, useState, type FormEvent } from 'react';
import { requestCode, verifyCode } from '../api/users';
import { signInWithToken } from '../lib/account';

/** Sends a one-time code to the email and signs the person in when they enter it. */
export function CodeStep({ email, onDone }: { email: string; onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function send() {
    setError(null);
    try {
      const r = await requestCode(email);
      setDevCode(r.devCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send a code.');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await verifyCode(email, code.trim());
      signInWithToken(token);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not right.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="codestep">
      <h1>Check your email</h1>
      <p>
        We sent a 6-digit code to <strong>{email}</strong>. It works for 10 minutes.
      </p>
      {devCode && (
        <div className="notice notice--amber">
          <strong>Test version:</strong> email sending isn't connected yet, so your code is shown here: <span className="mono">{devCode}</span>{' '}
          <button type="button" className="linkbtn" onClick={() => setCode(devCode)}>
            Fill it in
          </button>
        </div>
      )}
      <div className="field">
        <label htmlFor="otp">6-digit code</label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn--lg" type="submit" disabled={busy || code.length !== 6}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <p className="gs__fine">
        Didn't get it?{' '}
        <button type="button" className="linkbtn" onClick={() => void send()}>
          Send a new code
        </button>
      </p>
    </form>
  );
}
