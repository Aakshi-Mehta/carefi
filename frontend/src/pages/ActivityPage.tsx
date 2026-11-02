import { useQuery } from '@tanstack/react-query';
import { History, Activity } from 'lucide-react';
import { activityApi } from '../api/endpoints';
import type { AuditLog } from '../types';
import { format } from 'date-fns';
import { useState } from 'react';

const ACTION_COLOR: Record<string, string> = {
  PATIENT_CREATED: '#0F9D8A',
  DOCUMENT_UPLOADED: '#2563EB',
  QUERY_UPLOADED: '#D97706',
  REQUIREMENTS_EXTRACTED: '#7C3AED',
  DOCUMENT_MATCHED: '#16A34A',
  NOTIFICATION_SENT: '#0F9D8A',
  USER_LOGIN: '#64748B',
  DELIVERY_CALLBACK: '#16A34A',
  USER_CREATED: '#64748B',
  PATIENT_UPDATED: '#0F9D8A',
  DOCUMENT_VERIFIED: '#16A34A',
  REQUIREMENTS_APPROVED: '#7C3AED',
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['activity', page],
    queryFn: () => activityApi.list({ page, limit: 50 }).then((r) => r.data),
  });

  const logs = data?.data || [];
  const total = data?.pagination?.total || 0;
  const pages = Math.ceil(total / 50);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={20} color="var(--primary-navy)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Activity History</h1>
          <span className="badge badge-gray">{total} events</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Complete audit trail of all system actions with accurate timestamps.
        </p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Timestamp</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Resource ID</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading activity…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    No activity recorded yet.
                  </td></tr>
                ) : (
                  logs.map((log: AuditLog) => (
                    <tr key={log._id}>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                          <Activity size={10} color={ACTION_COLOR[log.action] || '#64748B'} />
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td><span className="badge badge-navy" style={{ fontSize: 10 }}>{log.resourceType}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.resourceId}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.actor}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
