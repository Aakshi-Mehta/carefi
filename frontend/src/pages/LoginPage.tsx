import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('admin@demo.revnow.local');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setAuth(res.data.token, res.data.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #102A43, #0F9D8A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 4px 20px rgba(15,157,138,0.25)',
          }}>
            <Zap size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            RevNow Query Intelligence
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Healthcare Revenue Cycle Management
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <div className="notice-banner demo" style={{ marginBottom: 20 }}>
            <span>⚠️</span>
            <span>
              <strong>Sandbox environment.</strong> Pre-filled with test credentials.
              Groq AI processes query text. Use fictional patient data only.
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: '#94A3B8',
                }} />
                <input
                  id="login-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: 34 }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: '#94A3B8',
                }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: 34, paddingRight: 36 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2,
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, marginTop: 20 }}>
          RevNow Query Intelligence — Proposed Feature Module for Care.fi<br />
          Assignment prototype. Not approved for real patient data.
        </p>
      </div>
    </div>
  );
}
