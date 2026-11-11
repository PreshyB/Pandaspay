import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CodeStep } from '../components/CodeStep';
import { useAccount } from '../lib/account';

export default function SignInPage() {
  const navigate = useNavigate();
  const { user } = useAccount();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');

  if (user) {
    return (
      <div className="card empty">
        <h1>You're signed in</h1>
        <p>Signed in as {user.fullName}.</p>
        <Link className="btn" to="/get-started">
          Continue
        </Link>
      </div>
    );
  }

  if (step === 'code') return <CodeStep email={email.trim()} onDone={() => navigate('/get-started')} />;

  return (
    <form
      className="gs__form"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setStep('code');
      }}
    >
      <h1>Sign in</h1>
      <p>Enter the email on your account and we'll send a code.</p>
      <div className="field">
        <label htmlFor="si-email">Email</label>
        <input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <button className="btn btn--lg btn--block" type="submit" disabled={!email.trim()}>
        Send code
      </button>
      <p className="gs__fine">
        New here? <Link to="/get-started">Create an account</Link>
      </p>
    </form>
  );
}
