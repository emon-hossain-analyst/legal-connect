import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import PasswordStrength from '../../components/PasswordStrength/PasswordStrength';
import styles from './Auth.module.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends a recovery token via URL hash fragment.
  // The supabase-js client automatically picks it up and sets a session.
  // We listen for the PASSWORD_RECOVERY event to know we're ready.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (e.g., page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validate = () => {
    const e = {};
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Min 8 characters';
    else if (!/[A-Z]/.test(password)) e.password = 'Must contain an uppercase letter';
    else if (!/[0-9]/.test(password)) e.password = 'Must contain a number';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password reset successfully! Please login.');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      const msg = err?.message || 'Reset failed. The link may be expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <Card className={styles.authCard}>
        <h2>Reset Password</h2>
        <p className={styles.subtitle}>Enter your new password</p>

        {!sessionReady ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: '#6B7280' }}>Verifying your reset link…</p>
            <div style={{ margin: '1rem auto', width: 32, height: 32, border: '3px solid #E5E7EB', borderTop: '3px solid #0E7490', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="new-password">New Password</label>
              <input
                type="password"
                id="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                placeholder="Enter new password"
                className={errors.password ? styles.inputError : ''}
              />
              <PasswordStrength password={password} />
              {errors.password && <span className={styles.error}>{errors.password}</span>}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="confirm-new-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                placeholder="Confirm new password"
                className={errors.confirmPassword ? styles.inputError : ''}
              />
              {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword}</span>}
            </div>
            <Button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </Button>
          </form>
        )}

        <p className={styles.switchAuth}>
          <Link to="/login">Back to Login</Link>
        </p>
      </Card>
    </div>
  );
};

export default ResetPassword;
