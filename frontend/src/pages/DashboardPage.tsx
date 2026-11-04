import { useQuery } from '@tanstack/react-query';
import {
  Users, FileText, FolderOpen, Search, AlertCircle,
  MessageSquare, Bell, TrendingUp, Clock, CheckCircle,
  XCircle, Activity,
} from 'lucide-react';
import { dashboardApi } from '../api/endpoints';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import type { AuditLog, DashboardStats } from '../types';

const ACTION_ICON: Record<string, React.ReactNode> = {
  PATIENT_CREATED: <Users size={13} />,
  DOCUMENT_UPLOADED: <FolderOpen size={13} />,
  QUERY_UPLOADED: <Search size={13} />,
  REQUIREMENTS_EXTRACTED: <Activity size={13} />,
  DOCUMENT_MATCHED: <CheckCircle size={13} />,
  NOTIFICATION_SENT: <MessageSquare size={13} />,
  USER_LOGIN: <TrendingUp size={13} />,
  DELIVERY_CALLBACK: <Bell size={13} />,
};

function StatCard({
  label, value, icon, color, link,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  link?: string;
}) {
  const content = (
    <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div className="stat-icon" style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
  if (link) return <Link to={link} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link>;
  return content;
}

function ActivityRow({ log }: { log: AuditLog }) {
  const icon = ACTION_ICON[log.action] || <Activity size={13} />;
  return (
    <tr>
      <td style={{ width: 32 }}>
        <span style={{ color: 'var(--primary-teal)' }}>{icon}</span>
      </td>
      <td>
        <span style={{ fontWeight: 500 }}>{log.action.replace(/_/g, ' ')}</span>
        {' '}
        <span style={{ color: 'var(--text-secondary)' }}>
          {log.resourceType} {log.resourceId}
        </span>
      </td>
      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
      </td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
        {log.actor}
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const stats: DashboardStats = data?.stats || {
    totalPatients: 0, activeClaims: 0, pendingQueries: 0,
    totalDocuments: 0, missingDocuments: 0, queriesNeedingReview: 0,
    pendingNotifications: 0,
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Overview</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
              RevNow Query Intelligence — Hospital Administration Dashboard
            </p>
          </div>
          <div className="badge badge-warning" style={{ fontSize: 12 }}>
            ⚠️ Sandbox — Synthetic Data Only
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="notice-banner error" style={{ marginBottom: 20 }}>
            <XCircle size={14} />
            <span>Could not load dashboard data. Ensure the API is running on port 3001.</span>
          </div>
        )}

        <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Start here</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            Follow these steps to process an insurer query. Uploading a query automatically extracts requests,
            checks the patient locker, and attempts both configured message channels.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {[
              { step: '1', title: 'Create or find a patient', detail: 'Open the patient profile.', to: '/patients' },
              { step: '2', title: 'Add a claim and documents', detail: 'Link existing records to the patient and claim.', to: '/claims' },
              { step: '3', title: 'Upload the insurer query', detail: 'Start from the patient’s claim or query list.', to: '/queries' },
              { step: '4', title: 'Review the outcome', detail: 'Check extracted items, matches, and channel status.', to: '/queries' },
            ].map(({ step, title, detail, to }) => (
              <Link key={step} to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8, height: '100%' }}>
                  <span className="badge badge-info">{step}</span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{title}</span>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{detail}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Patients" value={isLoading ? '—' : stats.totalPatients} icon={<Users size={18} />} color="#102A43" link="/patients" />
          <StatCard label="Active Claims" value={isLoading ? '—' : stats.activeClaims} icon={<FileText size={18} />} color="#0F9D8A" link="/claims" />
          <StatCard label="Pending Queries" value={isLoading ? '—' : stats.pendingQueries} icon={<Search size={18} />} color="#D97706" link="/queries" />
          <StatCard label="Documents" value={isLoading ? '—' : stats.totalDocuments} icon={<FolderOpen size={18} />} color="#2563EB" link="/locker" />
          <StatCard label="Missing Docs" value={isLoading ? '—' : stats.missingDocuments} icon={<AlertCircle size={18} />} color="#DC2626" link="/missing" />
          <StatCard label="Needs Review" value={isLoading ? '—' : stats.queriesNeedingReview} icon={<Clock size={18} />} color="#D97706" link="/queries" />
          <StatCard label="Notifications Pending" value={isLoading ? '—' : stats.pendingNotifications} icon={<MessageSquare size={18} />} color="#16A34A" link="/communications" />
        </div>

        {/* Action summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertCircle size={16} color="var(--danger)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Missing Documents</span>
              {stats.missingDocuments > 0 && (
                <span className="badge badge-danger">{stats.missingDocuments}</span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              {stats.missingDocuments > 0
                ? `${stats.missingDocuments} document requirement(s) are unresolved. Generate patient notifications to request them.`
                : 'No missing documents currently identified.'}
            </p>
            <Link to="/missing" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
              View Missing Docs
            </Link>
          </div>

          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Search size={16} color="var(--primary-teal)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Insurer Queries</span>
              {stats.pendingQueries > 0 && (
                <span className="badge badge-warning">{stats.pendingQueries}</span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              {stats.pendingQueries > 0
                ? `${stats.pendingQueries} query letter(s) need requirement extraction and document matching.`
                : 'All query letters have been processed.'}
            </p>
            <Link to="/queries" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
              Process Queries
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color="var(--text-secondary)" />
            <span className="section-title" style={{ fontSize: 14 }}>Recent Activity</span>
          </div>
          <div className="table-wrapper">
            <table>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading…</td></tr>
                ) : data?.recentActivity?.length ? (
                  data.recentActivity.map((log: AuditLog) => (
                    <ActivityRow key={log._id} log={log} />
                  ))
                ) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>No activity yet. Add a patient or upload a query letter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
            <Link to="/activity" style={{ color: 'var(--primary-teal)', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
              View full activity log →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
