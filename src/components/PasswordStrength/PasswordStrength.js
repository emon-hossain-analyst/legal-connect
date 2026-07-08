import React from 'react';

const getStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', color: '#DC2626', percent: 20 };
  if (score <= 2) return { label: 'Weak', color: '#DC2626', percent: 33 };
  if (score <= 3) return { label: 'Moderate', color: '#C8920A', percent: 60 };
  if (score <= 4) return { label: 'Strong', color: '#1E6B4A', percent: 85 };
  return { label: 'Strong', color: '#1E6B4A', percent: 100 };
};

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const { label, color, percent } = getStrength(password);

  return (
    <div style={{ marginTop: '0.4rem' }}>
      <div style={{
        height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: color,
          borderRadius: 3, transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.78rem', color, fontWeight: 600, marginTop: '0.25rem', display: 'inline-block' }}>
        {label}
      </span>
    </div>
  );
};

export default PasswordStrength;
