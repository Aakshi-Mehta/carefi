import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Activity, CheckCircle, AlertCircle, Clock, FileText,
  MessageSquare, Send, CheckSquare, XSquare,
} from 'lucide-react';
import { queriesApi, notificationsApi } from '../api/endpoints';
import type { Requirement, Match, Notification } from '../types';
import { DOCUMENT_CATEGORY_LABELS } from '../types';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  MATCHED: { bg: '#DCFCE7', text: '#15803D', label: 'Matched' },
  MISSING: { bg: '#FEE2E2', text: '#B91C1C', label: 'Missing' },
  NEEDS_REVIEW: { bg: '#FEF3C7', text: '#B45309', label: 'Needs Review' },
  UNVERIFIED: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Unverified' },
  UNAVAILABLE: { bg: '#F1F5F9', text: '#64748B', label: 'Unavailable' },
  PENDING: { bg: '#F1F5F9', text: '#64748B', label: 'Pending' },
  UNCERTAIN: { bg: '#FEF3C7', text: '#B45309', label: 'Uncertain' },
};

function RequirementCard({ req, match }: { req: Requirement; match?: Match }) {
  const status = match?.status || req.status;
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Status bar */}
        <div style={{ width: 4, background: s.text, flexShrink: 0 }} />

        <div style={{ flex: 1, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: s.bg, color: s.text,
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                }}>
                  {status === 'MATCHED' && <CheckCircle size={10} />}
                  {status === 'MISSING' && <AlertCircle size={10} />}
                  {(status === 'NEEDS_REVIEW' || status === 'UNCERTAIN') && <Clock size={10} />}
                  {s.label}
                </span>
                <span className="badge badge-info" style={{ fontSize: 10 }}>
                  {DOCUMENT_CATEGORY_LABELS[req.normalizedCategory] || req.normalizedCategory}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Confidence: {Math.round(req.confidence * 100)}%
                </span>
              </div>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                "{req.originalText}"
              </p>
            </div>
          </div>

          {/* Evidence from query */}
          <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Evidence from query letter
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{req.evidence}"
            </p>
          </div>

          {/* Match result */}
          {match && (
            <div style={{
              background: status === 'MATCHED' ? '#F0FDF4' : status === 'MISSING' ? '#FFF1F1' : '#FFFBEB',
              border: `1px solid ${status === 'MATCHED' ? '#BBF7D0' : status === 'MISSING' ? '#FECACA' : '#FDE68A'}`,
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Matching result
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {match.matchReason}
              </p>
              {match.evidence && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                  {match.evidence}
                </p>
              )}
              {match.documentId && (
                <span className="badge badge-success" style={{ marginTop: 6, fontSize: 10 }}>
                  Doc: {match.documentId}
                </span>
              )}
            </div>
          )}

          {/* Review status */}
          {(req.status === 'UNCERTAIN' || req.reviewStatus === 'PENDING') && (
            <div className="notice-banner info" style={{ marginTop: 8 }}>
              <Clock size={12} />
              <span>This requirement has low confidence and requires human review. Review status: {req.reviewStatus}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [notifMessage, setNotifMessage] = useState('');
  const [notifChannel, setNotifChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['query', id],
    queryFn: () => queriesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: notificationData, isLoading: notificationsLoading, isError: notificationsError } = useQuery({
    queryKey: ['notifications', id],
    queryFn: () => notificationsApi.list({ queryId: id!, limit: 100 }).then((r) => r.data),
    enabled: !!id,
  });

  const extractMutation = useMutation({
    mutationFn: () => queriesApi.extract(id!),
    onSuccess: (res) => {
      toast.success(`Extracted ${res.data.requirements.length} requirement(s)`);
      refetch();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Extraction failed');
    },
  });

  const matchMutation = useMutation({
    mutationFn: () => queriesApi.match(id!),
    onSuccess: (res) => {
      const s = res.data.summary;
      toast.success(`Matching: ${s.matched} matched, ${s.missing} missing`);
      refetch();
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Matching failed');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => queriesApi.approve(id!),
    onSuccess: (res) => {
      toast.success(res.data.message);
      refetch();
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => notificationsApi.generate(id!),
    onSuccess: (res) => {
      setNotifMessage(res.data.notification.message);
      setShowNotifPanel(true);
      if (!res.data.readyToSend) {
        toast('All documents are matched — no missing documents to notify patient about.', { icon: '✅' });
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not generate notification');
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => notificationsApi.send({
      queryId: id!,
      channel: notifChannel,
      messageText: notifMessage,
    }),
    onSuccess: (res) => {
      const n = res.data.notification;
      if (n.submissionStatus === 'SIMULATED') {
        toast('Simulated only — no message was delivered.', { icon: '⚠️' });
      } else if (n.submissionStatus === 'FAILED' || n.submissionStatus === 'NOT_CONFIGURED') {
        toast.error(`Message ${n.submissionStatus.toLowerCase().replace('_', ' ')}: ${n.errorMessage || n.provider}`);
      } else {
        toast.success(`Message ${n.submissionStatus.toLowerCase()} via ${n.provider}`);
      }
      setShowNotifPanel(false);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notifications', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Send failed');
    },
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading query…</div>;
  if (!data?.query) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Query not found</div>;

  const { query, requirements, matches } = data;
  const missingCount = requirements.filter((r: Requirement) => r.status === 'MISSING').length;
  const matchedCount = requirements.filter((r: Requirement) => r.status === 'MATCHED').length;
  const reviewCount = requirements.filter((r: Requirement) => r.status === 'UNCERTAIN' || r.status === 'NEEDS_REVIEW').length;
  const notifications = notificationData?.data || [];
  const channelNotification = (channel: 'WHATSAPP' | 'EMAIL') =>
    notifications.find((notification: Notification) => notification.channel === channel);
  const channelIsSuccessful = (channel: 'WHATSAPP' | 'EMAIL') => {
    const status = channelNotification(channel)?.submissionStatus;
    return status === 'SIMULATED' || status === 'QUEUED' || status === 'SUBMITTED';
  };
  const channelStatusLabel = (channel: 'WHATSAPP' | 'EMAIL') => {
    const notification = channelNotification(channel);
    if (notification) {
      return `${notification.submissionStatus.replace(/_/g, ' ')} · delivery ${notification.deliveryStatus.replace(/_/g, ' ')}`;
    }
    if (notificationsLoading) return 'Checking…';
    return notificationsError ? 'Status unavailable' : 'No attempt';
  };
  const hasMissingDelivery = (['WHATSAPP', 'EMAIL'] as const).some((channel) => !channelIsSuccessful(channel));

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <Link to="/queries" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Queries
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{query.queryId}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="badge badge-navy">Patient: {query.patientId}</span>
              <span className="badge badge-navy">Claim: {query.claimId}</span>
              <span className={`badge ${query.extractionStatus === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                Extraction: {query.extractionStatus}
              </span>
              <span className={`badge ${query.matchingStatus === 'COMPLETED' ? 'badge-success' : 'badge-gray'}`}>
                Matching: {query.matchingStatus}
              </span>
              {query.ocrUsed && <span className="badge badge-info">OCR Used</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(query.extractionStatus === 'PENDING' || query.extractionStatus === 'FAILED') && (
              <button
                id="extract-btn"
                className="btn btn-navy"
                onClick={() => extractMutation.mutate()}
                disabled={extractMutation.isPending}
              >
                <Activity size={14} />
                {extractMutation.isPending ? 'Extracting…' : query.extractionStatus === 'FAILED' ? 'Retry Extraction' : 'Extract Requirements'}
              </button>
            )}
            {query.extractionStatus === 'COMPLETED' && (query.matchingStatus === 'PENDING' || query.matchingStatus === 'FAILED') && (
              <button
                id="match-btn"
                className="btn btn-primary"
                onClick={() => matchMutation.mutate()}
                disabled={matchMutation.isPending}
              >
                <CheckCircle size={14} />
                {matchMutation.isPending ? 'Matching…' : query.matchingStatus === 'FAILED' ? 'Retry Matching' : 'Match Documents'}
              </button>
            )}
            {requirements.some((r: Requirement) => r.reviewStatus === 'PENDING') && (
              <button
                id="approve-btn"
                className="btn btn-outline"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckSquare size={14} /> Approve All
              </button>
            )}
            {query.matchingStatus === 'COMPLETED' && missingCount > 0 && !notificationsLoading && !notificationsError && hasMissingDelivery && (
              <button
                id="generate-notif-btn"
                className="btn btn-primary"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <MessageSquare size={14} />
                {generateMutation.isPending ? 'Preparing…' : 'Prepare Manual Message'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Main: requirements */}
        <div>
          {/* Summary bar */}
          {requirements.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#15803D' }}>{matchedCount}</div>
                <div style={{ fontSize: 11, color: '#15803D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Matched</div>
              </div>
              <div style={{ flex: 1, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C' }}>{missingCount}</div>
                <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Missing</div>
              </div>
              <div style={{ flex: 1, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#B45309' }}>{reviewCount}</div>
                <div style={{ fontSize: 11, color: '#B45309', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Needs Review</div>
              </div>
            </div>
          )}

          {/* Requirements */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} color="var(--text-secondary)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Extracted Requirements ({requirements.length})
            </span>
          </div>

          {requirements.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              {query.extractionStatus === 'PENDING'
                ? 'Requirements not yet extracted. Click "Extract Requirements" to begin.'
                : 'No requirements could be extracted from this query. Manual review required.'}
            </div>
          ) : (
            requirements.map((req: Requirement) => (
              <RequirementCard
                key={req._id}
                req={req}
                match={matches.find((item) => item.requirementId === String(req._id))}
              />
            ))
          )}
        </div>

        {/* Right: original query text + notification panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Automated Processing & Delivery
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                Query uploads automatically extract requirements, check the patient locker, and attempt WhatsApp and email when documents are missing.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <span>Extraction</span><strong>{query.extractionStatus.replace(/_/g, ' ')}</strong>
                <span>Document matching</span><strong>{query.matchingStatus.replace(/_/g, ' ')}</strong>
                <span>WhatsApp</span><strong>{channelStatusLabel('WHATSAPP').replace(/_/g, ' ')}</strong>
                <span>Email</span><strong>{channelStatusLabel('EMAIL').replace(/_/g, ' ')}</strong>
              </div>
              {notifications.map((notification: Notification) =>
                notification.errorMessage ? (
                  <div key={notification._id} className="notice-banner error" style={{ marginTop: 8 }}>
                    <span>{notification.channel}: {notification.errorMessage}</span>
                  </div>
                ) : null
              )}
              {notifications.some((notification: Notification) => notification.submissionStatus === 'SIMULATED') && (
                <div className="notice-banner demo" style={{ marginTop: 8 }}>
                  <AlertCircle size={12} />
                  <span>One or more messages were simulated. They were not delivered to the patient.</span>
                </div>
              )}
              {notifications.some((notification: Notification) => notification.submissionStatus === 'SUBMITTED') && (
                <div className="notice-banner info" style={{ marginTop: 8 }}>
                  <CheckCircle size={12} />
                  <span>Submitted to the messaging provider. Submission does not by itself confirm delivery.</span>
                </div>
              )}
              {notificationsError && (
                <div className="notice-banner error" style={{ marginTop: 8 }}>
                  <AlertCircle size={12} />
                  <span>Could not load delivery history. Refresh before attempting a manual follow-up.</span>
                </div>
              )}
              {reviewCount > 0 && (
                <div className="notice-banner info" style={{ marginTop: 10 }}>
                  <Clock size={12} />
                  <span>Some items need staff review. Automatic patient messaging was held for this query.</span>
                </div>
              )}
              {query.matchingStatus === 'COMPLETED' && missingCount === 0 && (
                <div className="notice-banner info" style={{ marginTop: 10 }}>
                  <CheckCircle size={12} />
                  <span>All requested documents were found in the locker; no patient message was needed.</span>
                </div>
              )}
              {query.matchingStatus === 'COMPLETED' && missingCount > 0 && !notificationsLoading && !notificationsError && notifications.length === 0 && reviewCount === 0 && (
                <div className="notice-banner info" style={{ marginTop: 10 }}>
                  <AlertCircle size={12} />
                  <span>No delivery attempt is recorded. Prepare a manual message for follow-up.</span>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Original Query Text
            </div>
            <div style={{ padding: '12px 14px', maxHeight: 360, overflowY: 'auto' }}>
              <pre style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>
                {query.originalText}
              </pre>
            </div>
          </div>

          {/* Notification panel */}
          {showNotifPanel && (
            <div className="card">
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={14} color="var(--primary-teal)" />
                Patient Notification
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div className="notice-banner info" style={{ marginBottom: 12 }}>
                  <span>ℹ️ This is a manual follow-up. The recorded channel status will show whether it was simulated, submitted, or failed.</span>
                </div>

                <label className="form-label">Channel</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['WHATSAPP', 'EMAIL'] as const).map((ch) => (
                    <button
                      key={ch}
                      className={`btn btn-sm ${notifChannel === ch ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setNotifChannel(ch)}
                      disabled={channelIsSuccessful(ch)}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                <label className="form-label">Message (editable)</label>
                <textarea
                  id="notif-message"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  rows={10}
                  className="input"
                  style={{ resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', fontSize: 12 }}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowNotifPanel(false)}>
                    <XSquare size={13} /> Cancel
                  </button>
                  <button
                    id="send-notif-btn"
                    className="btn btn-primary btn-sm"
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending || !notifMessage}
                    style={{ flex: 1 }}
                  >
                    <Send size={13} />
                    {sendMutation.isPending ? 'Sending…' : `Send via ${notifChannel}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
