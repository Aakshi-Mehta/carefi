import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserPlus, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'reviewer'>('staff');

  const createUser = useMutation({
    mutationFn: () => authApi.register({ name, email, password, role }),
    onSuccess: (response) => {
      toast.success(`Created ${response.data.user.role} account for ${response.data.user.email}`);
      setName('');
      setEmail('');
      setPassword('');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'Could not create account');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUser.mutate();
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color="var(--primary-navy)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Settings</h1>
        </div>
      </div>

      <div className="page-body">
        <section className="card" style={{ maxWidth: 680, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <UserPlus size={17} color="var(--primary-teal)" />
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Create team account</h2>
          </div>

          {user?.role !== 'admin' ? (
            <div className="notice-banner info">Administrator access is required to create accounts.</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label className="form-label" htmlFor="team-name">Name</label>
                  <input id="team-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="team-email">Email</label>
                  <input id="team-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="team-password">Temporary password</label>
                  <input id="team-password" type="password" minLength={8} className="input" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="team-role">Role</label>
                  <select id="team-role" className="input" value={role} onChange={(event) => setRole(event.target.value as 'staff' | 'reviewer')}>
                    <option value="staff">Staff</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={createUser.isPending} style={{ marginTop: 18 }}>
                <UserPlus size={14} />
                {createUser.isPending ? 'Creating…' : 'Create account'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
