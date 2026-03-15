import { useState } from 'react';

interface EmailCaptureFormProps {
  source: string;
  title?: string;
  description?: string;
}

export default function EmailCaptureForm({
  source,
  title = 'Get state pullout alerts and ban intel in your inbox',
  description = 'Join the waitlist for public intel updates. No account required.',
}: EmailCaptureFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/waitlist/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const data = await response.json();

      if (response.ok || data.error === 'Already subscribed') {
        setMessage(
          data.error === 'Already subscribed'
            ? "You're already subscribed."
            : "You're in. We'll keep you posted.",
        );
        setEmail('');
        return;
      }

      setMessage(data.error ?? 'Unable to subscribe right now.');
    } catch (error) {
      console.error(error);
      setMessage('Unable to subscribe right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="waitlist-banner">
      <div className="waitlist-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {message ? (
        <div className="waitlist-message">{message}</div>
      ) : (
        <form className="waitlist-form" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
            autoComplete="email"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Subscribe'}
          </button>
        </form>
      )}

      <style>{`
        .waitlist-banner {
          display: grid;
          gap: 1rem;
          padding: 1.25rem;
          border: 1px solid var(--color-border);
          border-radius: 1.5rem;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(255, 255, 255, 0.95));
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }

        .waitlist-copy h2 {
          margin: 0 0 0.35rem;
          font-size: 1.1rem;
          letter-spacing: -0.03em;
        }

        .waitlist-copy p,
        .waitlist-message {
          margin: 0;
          color: var(--color-muted);
          line-height: 1.55;
        }

        .waitlist-form {
          display: grid;
          gap: 0.75rem;
        }

        .waitlist-form input {
          min-width: 0;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          padding: 0.9rem 1rem;
          font: inherit;
        }

        .waitlist-form button {
          border: none;
          border-radius: 999px;
          background: var(--color-primary);
          color: #fff;
          padding: 0.9rem 1.1rem;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        @media (min-width: 768px) {
          .waitlist-banner {
            grid-template-columns: 1.2fr 1fr;
            align-items: center;
          }

          .waitlist-form {
            grid-template-columns: 1fr auto;
          }
        }
      `}</style>
    </section>
  );
}
