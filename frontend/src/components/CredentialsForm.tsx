import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

interface CredentialsFormProps {
  sessionId: string;
  captchaBase64: string | null;
  statusDetail: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CredentialsForm: React.FC<CredentialsFormProps> = ({ 
  sessionId, 
  captchaBase64, 
  statusDetail,
  onSuccess,
  onCancel
}) => {
  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!netId || !password || !captcha) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/connect/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, netId, password, captcha })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to submit credentials');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      maxWidth: '440px',
      margin: '2rem auto',
      padding: '2rem',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
          Connect to SRM
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          {statusDetail || 'Please enter your portal credentials.'}
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.75rem',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#f87171',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '0.85rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            NetID
          </label>
          <input
            type="text"
            value={netId}
            onChange={(e) => setNetId(e.target.value)}
            placeholder="AB1234"
            disabled={isSubmitting}
            autoCapitalize="characters"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            CAPTCHA
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            {captchaBase64 ? (
              <img 
                src={`data:image/jpeg;base64,${captchaBase64}`} 
                alt="CAPTCHA" 
                style={{ height: '48px', borderRadius: '4px', background: 'white', padding: '4px' }} 
              />
            ) : (
              <div style={{ height: '48px', width: '120px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Loading...
              </div>
            )}
          </div>
          <input
            type="text"
            value={captcha}
            onChange={(e) => setCaptcha(e.target.value)}
            placeholder="Enter CAPTCHA text"
            disabled={isSubmitting || !captchaBase64}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '0.85rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !captchaBase64}
            style={{
              flex: 2,
              padding: '0.85rem',
              background: 'var(--primary)',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: (isSubmitting || !captchaBase64) ? 'not-allowed' : 'pointer',
              opacity: (isSubmitting || !captchaBase64) ? 0.7 : 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', margin: 0 }}></span>
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
        
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem', lineHeight: 1.4 }}>
          Credentials are sent securely to proxy your login.<br/>They are <strong>never stored</strong> in any database.
        </p>
      </form>
    </div>
  );
};
