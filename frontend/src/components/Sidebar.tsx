import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, FolderOpen, Search,
  AlertCircle, MessageSquare, History, Settings, Plug, LogOut,
  Zap
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/claims', label: 'Claims', icon: FileText },
  { to: '/locker', label: 'Patient Locker', icon: FolderOpen },
  { to: '/queries', label: 'Insurer Queries', icon: Search },
  { to: '/missing', label: 'Missing Documents', icon: AlertCircle },
  { to: '/communications', label: 'Communications', icon: MessageSquare },
  { to: '/activity', label: 'Activity History', icon: History },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <nav className="sidebar" style={{ overflowY: 'auto' }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #0F9D8A, #087F73)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>RevNow</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Query Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ padding: '12px 10px', flex: 1 }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 7,
              marginBottom: 2,
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {user && (
          <div style={{ padding: '10px', marginBottom: 6 }}>
            <div style={{ color: 'white', fontWeight: 500, fontSize: 12 }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.45)', fontSize: 13,
          }}
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
