import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import styles from './Auth.module.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Reset link sent! Check your email.');
    } catch (err) {
      // Don't reveal whether the email exists
      setSent(true);
      toast.success('If an account exists with this email, a reset link has been sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <Card className={styles.authCard}>
        <h2>Forgot Password</h2>
        <p className={styles.subtitle}>Enter your email to receive a password reset link</p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
            <p style={{ color: '#1A1F2E', fontWeight: 500, marginBottom: '0.5rem' }}>Check your inbox</p>
            <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
              If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="reset-email">Email Address</label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        <p className={styles.switchAuth}>
          Remember your password? <Link to="/login">Login here</Link>
        </p>
      </Card>
    </div>
  );
};

export default ForgotPassword;
