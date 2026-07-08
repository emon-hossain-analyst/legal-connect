import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const Register = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    user_type: 'client', // Default is client
    terms: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password Strength Logic
  const passwordStats = useMemo(() => {
    const val = formData.password;
    const hasLen = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasSpec = /[^A-Za-z0-9]/.test(val);
    
    let score = 0;
    if (hasLen) score++;
    if (hasUpper) score++;
    if (hasNum) score++;
    if (hasSpec) score++;

    let width = '0%';
    let color = 'bg-error';
    let label = 'None';

    if (val.length > 0) {
      if (score <= 1) {
        width = '25%';
        color = 'bg-error';
        label = 'Weak';
      } else if (score <= 3) {
        width = '60%';
        color = 'bg-primary-fixed-dim';
        label = 'Moderate';
      } else {
        width = '100%';
        color = 'bg-primary';
        label = 'Strong';
      }
    }

    return { hasLen, hasUpper, hasNum, hasSpec, score, width, color, label };
  }, [formData.password]);

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    if (!formData.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Email is invalid';

    if (!formData.password) {
      e.password = 'Password is required';
    } else if (formData.password.length < 8) {
      e.password = 'Password must be at least 8 characters';
    }

    if (!formData.terms) {
      e.terms = 'You must agree to the terms';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (errors.submit) setErrors((prev) => ({ ...prev, submit: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        user_type: formData.user_type,
      };

      const response = await signUp(payload);
      const user = response.data?.user;
      const session = response.data?.session;

      if (user) {
        if (session) {
          setUser(user);
          navigate((user.user_type || payload.user_type) === 'client' ? '/client/dashboard' : '/lawyer-suite/dashboard', { replace: true });
        } else {
          toast.success('Registration successful! Please check your email to confirm your account before logging in.', { duration: 6000 });
          navigate('/login');
        }
      } else {
        setErrors({ submit: 'Registration succeeded but user info is unavailable. Please login.' });
      }
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-xl relative overflow-hidden bg-mesh-gradient font-body-md text-on-background min-h-[calc(100vh-64px)] selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Decorative subtle element */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 pointer-events-none"></div>
      
      <div className="w-full max-w-container-max px-gutter mx-auto grid grid-cols-1 lg:grid-cols-12 gap-xl items-center relative z-10 py-12">
        {/* Left Side: Branding & Value Prop */}
        <div className="lg:col-span-7 hidden lg:block">
          <h1 className="font-display-lg text-display-lg text-primary mb-md">Secure. Reliable.<br/>Professional.</h1>
          <p className="font-body-lg text-body-lg text-on-secondary-container max-w-xl mb-lg">
            Join the premier digital workspace for legal professionals and clients. Experience high-performance tools designed for the modern practice of law.
          </p>
          <div className="grid grid-cols-2 gap-md">
            <div className="flex gap-sm items-start">
              <span className="material-symbols-outlined text-primary verified-badge">verified_user</span>
              <div>
                <p className="font-label-md text-label-md text-on-surface font-bold">End-to-End Encryption</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Your documents and communications are secured with industry-standard protocols.</p>
              </div>
            </div>
            <div className="flex gap-sm items-start">
              <span className="material-symbols-outlined text-primary verified-badge">gavel</span>
              <div>
                <p className="font-label-md text-label-md text-on-surface font-bold">Verified Counsel</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Access a network of bar-certified legal experts vetted for excellence.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Registration Form Card */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg w-full max-w-md transition-all duration-300 hover:shadow-md">
            <div className="mb-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Create your account</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">Get started with LegalConnect today.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-sm" id="signupForm">
              
              {/* Account Type Selection */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">I am joining as a</label>
                <div className="grid grid-cols-2 gap-sm">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, user_type: 'client' }))}
                    className={`h-[48px] border rounded-lg flex items-center justify-center gap-xs transition-all ${formData.user_type === 'client' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-highest'}`}
                  >
                    <span className="material-symbols-outlined text-lg">person</span> Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, user_type: 'lawyer' }))}
                    className={`h-[48px] border rounded-lg flex items-center justify-center gap-xs transition-all ${formData.user_type === 'lawyer' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container-highest'}`}
                  >
                    <span className="material-symbols-outlined text-lg">gavel</span> Lawyer
                  </button>
                </div>
              </div>

              {/* Name Field */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="name">Full Name</label>
                <input 
                  className={`w-full h-[48px] bg-surface-container-low border ${errors.name ? 'border-error' : 'border-outline-variant'} rounded-lg px-md focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none`} 
                  id="name" name="name" 
                  value={formData.name} onChange={handleChange}
                  placeholder="John Doe" 
                  type="text" 
                />
                {errors.name && <p className="text-error text-xs">{errors.name}</p>}
              </div>

              {/* Email Field */}
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="email">Email Address</label>
                <input 
                  className={`w-full h-[48px] bg-surface-container-low border ${errors.email ? 'border-error' : 'border-outline-variant'} rounded-lg px-md focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none`} 
                  id="email" name="email" 
                  value={formData.email} onChange={handleChange}
                  placeholder="john@example.com" 
                  type="email" 
                />
                {errors.email && <p className="text-error text-xs">{errors.email}</p>}
              </div>

              {/* Password Field */}
              <div className="space-y-xs relative">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">Password</label>
                <div className="relative">
                  <input 
                    className={`w-full h-[48px] bg-surface-container-low border ${errors.password ? 'border-error' : 'border-outline-variant'} rounded-lg px-md pr-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none`} 
                    id="password" name="password" 
                    value={formData.password} onChange={handleChange}
                    placeholder="••••••••" 
                    type={showPassword ? 'text' : 'password'} 
                  />
                  <button 
                    className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary" 
                    onClick={() => setShowPassword(!showPassword)} 
                    type="button"
                  >
                    <span className="material-symbols-outlined" id="eyeIcon">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.password && <p className="text-error text-xs">{errors.password}</p>}

                {/* Password Strength Meter */}
                <div className="mt-base space-y-xs">
                  <div className="flex justify-between items-center h-1 bg-surface-container-high rounded-full overflow-hidden">
                    <div className={`pw-strength-bar h-full ${passwordStats.color}`} style={{ width: passwordStats.width }}></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Password strength: <span className="font-bold">{passwordStats.label}</span>
                    </span>
                    <div className="flex gap-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordStats.hasLen ? 'bg-primary' : 'bg-outline-variant'}`} title="At least 8 characters"></div>
                      <div className={`w-2 h-2 rounded-full ${passwordStats.hasUpper ? 'bg-primary' : 'bg-outline-variant'}`} title="Uppercase letter"></div>
                      <div className={`w-2 h-2 rounded-full ${passwordStats.hasNum ? 'bg-primary' : 'bg-outline-variant'}`} title="Number"></div>
                      <div className={`w-2 h-2 rounded-full ${passwordStats.hasSpec ? 'bg-primary' : 'bg-outline-variant'}`} title="Special character"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-sm pt-xs">
                <input 
                  className="mt-1 w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary" 
                  id="terms" name="terms" 
                  checked={formData.terms} onChange={handleChange}
                  type="checkbox" 
                />
                <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor="terms">
                  I agree to the <Link to="/terms" className="text-primary hover:underline">Attorney Agreement</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </label>
              </div>
              {errors.terms && <p className="text-error text-xs mt-1">{errors.terms}</p>}

              {errors.submit && <div className="text-error text-sm mt-2 text-center">{errors.submit}</div>}

              {/* Submit Button */}
              <button 
                className={`w-full h-[48px] ${loading ? 'bg-tertiary-container' : 'bg-primary'} text-on-primary font-label-md text-label-md rounded-lg hover:shadow-lg transition-all duration-200 active:scale-[0.98] mt-sm flex items-center justify-center`} 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-md">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant"></div></div>
              <div className="relative flex justify-center text-label-sm"><span className="bg-surface-container-lowest px-sm text-on-surface-variant">OR CONTINUE WITH</span></div>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-sm">
              <button type="button" className="flex items-center justify-center gap-xs h-[40px] border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                <img alt="Google" className="w-4 h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB60NJE31JER13BiwgRXf2aYNpgdA0HwXpTvt-DZ0Xj3SBsqV6-iFHcHVbr7HEoo7f-lN3gyR9l1aWc2fbsp__Yf3o2zK1x0N1bjPCb3nH6d8UjYOlgIunXuHqFdvh1RurxhDn0uEu9sitQsvqfoh5fM2nLq8oVN1GtHsPRN-8z1GVLsBvIS6STviJAskrcvPaiOyQ3OzWMehgSkqEOx0xolXP6DPNOTrm3uBwj-FpHew4igbGaYb81Q9cP30sDXpUj3njB_gx1VwvY"/>
                <span className="font-label-sm text-label-sm">Google</span>
              </button>
              <button type="button" className="flex items-center justify-center gap-xs h-[40px] border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
                <img alt="Apple" className="w-4 h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyrxHF4qovQpWyW0gSBkFTIeFLjgDxTnpnNDK0QVSRNoJF2simxkKtlnnKaqRzeVjE8hRj5DhOlNBxJp9McLZ6pO_vo4tFIpb_cBpZ7TteKD1aic4E5_0TJgOgW-zbNFIVwZkWykHPIh9IggmlrlJQxEg2zXxOty_yxrPy2LHFN4YTBkWT7_vYt8GxVykJjnwqt5WqjDddxxc2e65kT6B5oSq_6QmwwySNpI2TICo_lZeB-wLKbZT_l28qtNjz5DQ-AxMlT7U6cooe"/>
                <span className="font-label-sm text-label-sm">Apple</span>
              </button>
            </div>

            <p className="text-center font-body-sm text-body-sm text-on-surface-variant mt-lg">
              Already have an account? <Link className="text-primary font-bold hover:underline" to="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Register;
