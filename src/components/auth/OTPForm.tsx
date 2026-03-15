import { useState } from 'react';

interface OTPFormProps {
  redirectTo?: string;
  title?: string;
  description?: string;
}

type FormStep = 'email' | 'otp';

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  const rawText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return {};
    }
  }

  if (
    rawText.includes('Vercel Authentication') ||
    rawText.includes('Authentication Required')
  ) {
    return {
      error:
        'This preview deployment is behind Vercel authentication, so login requests are being blocked before they reach the app. Test on the production domain or disable preview protection for this deployment.',
    };
  }

  return {};
}

export default function OTPForm({
  redirectTo = '/tracker',
  title = 'Save your data with email login',
  description = 'Enter your email and we will send a 6-digit login code.',
}: OTPFormProps) {
  const [step, setStep] = useState<FormStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? 'Unable to send code.');
        return;
      }

      setStep('otp');
      setMessage('Code sent. Check your inbox.');
    } catch (requestError) {
      console.error(requestError);
      setError('Unable to send code.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, otp }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        setError(data.error ?? 'Unable to verify code.');
        return;
      }

      window.location.assign(redirectTo);
    } catch (requestError) {
      console.error(requestError);
      setError('Unable to verify code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="login"
      style={{
        width: '100%',
        maxWidth: '28rem',
        borderRadius: '1.5rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--color-border)',
        padding: '1.4rem',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.32)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '1rem' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '1.35rem',
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      {message ? (
        <div
          style={{
            marginBottom: '0.9rem',
            borderRadius: '0.9rem',
            background: 'rgba(16, 185, 129, 0.14)',
            color: 'var(--accent-green)',
            padding: '0.8rem 0.9rem',
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginBottom: '0.9rem',
            borderRadius: '0.9rem',
            background: 'rgba(239, 68, 68, 0.14)',
            color: 'var(--accent-red)',
            padding: '0.8rem 0.9rem',
          }}
        >
          {error}
        </div>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={sendCode} style={{ display: 'grid', gap: '0.85rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-secondary)' }}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{
                borderRadius: '0.95rem',
                border: '1px solid var(--color-border)',
                background: 'var(--bg-primary)',
                padding: '0.9rem 1rem',
                fontSize: '1rem',
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: '999px',
              background: 'var(--accent-blue)',
              color: 'var(--text-primary)',
              padding: '0.9rem 1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Sending...' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} style={{ display: 'grid', gap: '0.85rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-secondary)' }}>
            <span>6-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
              style={{
                borderRadius: '0.95rem',
                border: '1px solid var(--color-border)',
                background: 'var(--bg-primary)',
                padding: '0.9rem 1rem',
                fontSize: '1.1rem',
                letterSpacing: '0.35em',
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: '999px',
              background: 'var(--accent-blue)',
              color: 'var(--text-primary)',
              padding: '0.9rem 1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setOtp('');
              setMessage(null);
              setError(null);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </section>
  );
}

