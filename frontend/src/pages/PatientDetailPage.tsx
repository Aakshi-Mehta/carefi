import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, Phone, Mail, FileText, FolderOpen, Search, MessageSquare, Download } from 'lucide-react';
import { patientsApi, claimsApi, documentsApi, downloadDocumentFile, queriesApi, notificationsApi } from '../api/endpoints';
import type { Claim, PatientDocument, Query, Notification } from '../types';
import { DOCUMENT_CATEGORY_LABELS } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CLAIM_STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge-gray',
  QUERY_RECEIVED: 'badge-warning',
  DOCUMENTS_PENDING: 'badge-danger',
  UNDER_REVIEW: 'badge-info',
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
  CLOSED: 'badge-gray',
};

const VERIFY_BADGE: Record<string, string> = {
  VERIFIED: 'badge-success',
  UNVERIFIED: 'badge-warning',
  REJECTED: 'badge-danger',
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: claimsData } = useQuery({
    queryKey: ['claims', id],
    queryFn: () => claimsApi.list({ patientId: id }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: docsData } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.list({ patientId: id, limit: 50 } as Parameters<typeof documentsApi.list>[0]).then((r) => r.data),
    enabled: !!id,
  });

  const { data: queriesData } = useQuery({
    queryKey: ['queries', id],
    queryFn: () => queriesApi.list({ patientId: id }).then((r) => r.data),
    enabled: !!id,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications', id],
    queryFn: () => notificationsApi.list({ patientId: id }).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading patient…</div>;
  if (!patient) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Patient not found</div>;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <Link to="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Patients
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color="var(--primary-teal)" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{patient.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <span className="badge badge-navy">{patient.patientId}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Since {format(new Date(patient.createdAt), 'dd MMM yyyy')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Left: patient info */}
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: 'var(--text-primary)' }}>Contact Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <Phone size={14} color="var(--text-secondary)" /> {patient.phone}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, wordBreak: 'break-all' }}>
                <Mail size={14} color="var(--text-secondary)" /> {patient.email}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Claims</span>
              <span className="badge badge-navy">{claimsData?.pagination?.total || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Documents</span>
              <span className="badge badge-info">{docsData?.pagination?.total || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Queries</span>
              <span className="badge badge-gray">{queriesData?.pagination?.total || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Notifications</span>
              <span className="badge badge-gray">{notifData?.pagination?.total || 0}</span>
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Claims */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Claims</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Claim ID</th><th>Insurer</th><th>Hospital</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {claimsData?.data?.length ? claimsData.data.map((c: Claim) => (
                    <tr key={c._id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-teal)' }}>{c.claimId}</td>
                      <td>{c.insurer}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.hospital}</td>
                      <td><span className={`badge ${CLAIM_STATUS_BADGE[c.status] || 'badge-gray'}`}>{c.status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <Link to={`/queries?claimId=${c.claimId}`} className="btn btn-outline btn-sm">
                          <Search size={11} /> Queries
                        </Link>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No claims found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={15} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Document Locker</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>File</th><th>Category</th><th>Claim</th><th>Source</th><th>Verified</th><th></th>
                </tr></thead>
                <tbody>
                  {docsData?.data?.length ? docsData.data.map((d: PatientDocument) => (
                    <tr key={d._id}>
                      <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</td>
                      <td><span className="badge badge-info">{DOCUMENT_CATEGORY_LABELS[d.category] || d.category}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{d.claimId || '—'}</td>
                      <td><span className="badge badge-gray">{d.source}</span></td>
                      <td><span className={`badge ${VERIFY_BADGE[d.verificationStatus]}`}>{d.verificationStatus}</span></td>
                      <td>
                        {d.storageFileId && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => downloadDocumentFile(d.documentId, d.fileName).catch(() => toast.error('Download failed'))}
                            title="Download original file"
                          >
                            <Download size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No documents found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Query history */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={15} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Query History</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Query ID</th><th>File</th><th>Claim</th><th>Extraction</th><th>Matching</th><th></th>
                </tr></thead>
                <tbody>
                  {queriesData?.data?.length ? queriesData.data.map((q: Query) => (
                    <tr key={q._id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-teal)', fontSize: 12 }}>{q.queryId}</td>
                      <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.originalFileName}</td>
                      <td style={{ fontSize: 12 }}>{q.claimId}</td>
                      <td><span className={`badge ${q.extractionStatus === 'COMPLETED' ? 'badge-success' : q.extractionStatus === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>{q.extractionStatus}</span></td>
                      <td><span className={`badge ${q.matchingStatus === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{q.matchingStatus}</span></td>
                      <td>
                        <Link to={`/queries/${q.queryId}`} className="btn btn-outline btn-sm">View</Link>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No queries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notification history */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={15} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Notification History</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>ID</th><th>Channel</th><th>Provider</th><th>Submission</th><th>Delivery</th>
                </tr></thead>
                <tbody>
                  {notifData?.data?.length ? notifData.data.map((n: Notification) => (
                    <tr key={n._id}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.notificationId}</td>
                      <td><span className="badge badge-info">{n.channel}</span></td>
                      <td style={{ fontSize: 12 }}>{n.provider}</td>
                      <td><span className={`badge ${n.submissionStatus === 'SUBMITTED' ? 'badge-success' : n.submissionStatus === 'SIMULATED' ? 'badge-warning' : 'badge-danger'}`}>{n.submissionStatus}</span></td>
                      <td><span className={`badge ${n.deliveryStatus === 'DELIVERED' || n.deliveryStatus === 'READ' ? 'badge-success' : 'badge-gray'}`}>{n.deliveryStatus}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No notifications sent</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
