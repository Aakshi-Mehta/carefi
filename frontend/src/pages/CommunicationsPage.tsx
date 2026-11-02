import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Filter } from 'lucide-react';
import { notificationsApi } from '../api/endpoints';
import type { Notification } from '../types';
import { format } from 'date-fns';

const SUBMISSION_BADGE: Record<string, string> = {
  NOT_CONFIGURED: 'badge-gray',
  SIMULATED: 'badge-warning',
  QUEUED: 'badge-info',
  SUBMITTED: 'badge-success',
  FAILED: 'badge-danger',
};

const DELIVERY_BADGE: Record<string, string> = {
  NOT_CONFIGURED: 'badge-gray',
  SIMULATED: 'badge-warning',
  QUEUED: 'badge-info',
  SENT: 'badge-info',
  DELIVERED: 'badge-success',
  READ: 'badge-success',
  FAILED: 'badge-danger',
};

export default function CommunicationsPage() {
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', channel, status, page],
    queryFn: () => notificationsApi.list({
      channel: channel || undefined,
      submissionStatus: status || undefined,
      page,
    }).then((r) => r.data),
  });

  const notifications = data?.data || [];
  const total = data?.pagination?.total || 0;
  const pages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={20} color="var(--primary-navy)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Communications</h1>
          <span className="badge badge-gray">{total} total</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Patient notification history. All demo messages are labelled SIMULATED — no real messages sent.
        </p>
      </div>

      <div className="page-body">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select id="comms-channel" className="input" style={{ maxWidth: 160 }} value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}>
              <option value="">All Channels</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
            <select id="comms-status" className="input" style={{ maxWidth: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="SIMULATED">Simulated</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="FAILED">Failed</option>
              <option value="NOT_CONFIGURED">Not Configured</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Claim</th>
                  <th>Channel</th>
                  <th>Provider</th>
                  <th>Message ID</th>
                  <th>Submission</th>
                  <th>Delivery</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</td></tr>
                ) : notifications.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    No notifications found. Process a query and generate a patient notification.
                  </td></tr>
                ) : (
                  notifications.map((n: Notification) => (
                    <>
                      <tr key={n._id}>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.notificationId}</td>
                        <td style={{ fontSize: 12 }}>{n.patientId}</td>
                        <td style={{ fontSize: 12 }}>{n.claimId}</td>
                        <td><span className="badge badge-info" style={{ fontSize: 10 }}>{n.channel}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.provider}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {n.providerMessageId ? (
                            <span className="badge badge-success" style={{ fontSize: 10 }}>{n.providerMessageId.slice(0, 16)}…</span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>— (no real ID)</span>
                          )}
                        </td>
                        <td><span className={`badge ${SUBMISSION_BADGE[n.submissionStatus] || 'badge-gray'}`} style={{ fontSize: 10 }}>{n.submissionStatus}</span></td>
                        <td><span className={`badge ${DELIVERY_BADGE[n.deliveryStatus] || 'badge-gray'}`} style={{ fontSize: 10 }}>{n.deliveryStatus}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {format(new Date(n.createdAt), 'dd MMM HH:mm')}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpanded(expanded === n._id ? null : n._id)}
                            style={{ fontSize: 11 }}
                          >
                            {expanded === n._id ? 'Hide' : 'Message'}
                          </button>
                        </td>
                      </tr>
                      {expanded === n._id && (
                        <tr key={`${n._id}-msg`}>
                          <td colSpan={10} style={{ background: '#F8FAFC', padding: 0 }}>
                            <div style={{ padding: '12px 20px' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Message Content</div>
                              <pre style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontFamily: 'inherit', background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                                {n.message}
                              </pre>
                              {n.errorMessage && (
                                <div className="notice-banner error" style={{ marginTop: 8 }}>
                                  <span>Error: {n.errorMessage}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
