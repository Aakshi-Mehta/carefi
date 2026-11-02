import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Upload, Filter, Eye, Activity, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { queriesApi, patientsApi, claimsApi } from '../api/endpoints';
import type { Query, Patient, Claim } from '../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const EXTRACT_BADGE: Record<string, string> = {
  PENDING: 'badge-warning',
  PROCESSING: 'badge-info',
  COMPLETED: 'badge-success',
  FAILED: 'badge-danger',
  NEEDS_REVIEW: 'badge-warning',
};

function UploadQueryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [patientId, setPatientId] = useState('');
  const [claimId, setClaimId] = useState('');

  const { data: patientsData } = useQuery({
    queryKey: ['patients-all'],
    queryFn: () => patientsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const { data: claimsData } = useQuery({
    queryKey: ['claims-for-patient', patientId],
    queryFn: () => claimsApi.list({ patientId, limit: 50 } as Parameters<typeof claimsApi.list>[0]).then((r) => r.data),
    enabled: !!patientId,
  });

  const onDrop = useCallback((accepted: File[]) => setFile(accepted[0] || null), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file');
      const fd = new FormData();
      fd.append('queryFile', file);
      fd.append('patientId', patientId);
      fd.append('claimId', claimId);
      return queriesApi.upload(fd);
    },
    onSuccess: (res) => {
      toast.success(`Query uploaded: ${res.data.query.queryId}`);
      qc.invalidateQueries({ queryKey: ['queries'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Upload failed');
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Upload Insurer Query Letter</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="notice-banner demo" style={{ marginBottom: 16 }}>
            ⚠️ Upload synthetic query letters only in demo mode.
          </div>

          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--primary-teal)' : 'var(--border)'}`,
              borderRadius: 8, padding: '24px 20px', textAlign: 'center',
              cursor: 'pointer', background: isDragActive ? 'var(--mint)' : '#FAFBFC',
              marginBottom: 16,
            }}
          >
            <input {...getInputProps()} id="query-file-input" />
            <Upload size={24} color="var(--text-secondary)" style={{ margin: '0 auto 8px' }} />
            {file ? (
              <p style={{ fontWeight: 600, fontSize: 13 }}>{file.name}</p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                Drop PDF query letter here or click to select
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Patient *</label>
              <select id="query-patient" className="input" value={patientId} onChange={(e) => { setPatientId(e.target.value); setClaimId(''); }}>
                <option value="">Select patient…</option>
                {patientsData?.data?.map((p: Patient) => (
                  <option key={p._id} value={p.patientId}>{p.name} ({p.patientId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Claim *</label>
              <select id="query-claim" className="input" value={claimId} onChange={(e) => setClaimId(e.target.value)} disabled={!patientId}>
                <option value="">Select claim…</option>
                {claimsData?.data?.map((c: Claim) => (
                  <option key={c._id} value={c.claimId}>{c.claimId}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            id="query-upload-submit"
            className="btn btn-primary"
            disabled={mutation.isPending || !file || !patientId || !claimId}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Processing…' : 'Upload & Extract Text'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QueriesPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const qc = useQueryClient();

  const claimId = searchParams.get('claimId') || undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['queries', statusFilter, page, claimId],
    queryFn: () => queriesApi.list({
      status: statusFilter || undefined,
      claimId,
      page,
    }).then((r) => r.data),
  });

  const extractMutation = useMutation({
    mutationFn: (id: string) => queriesApi.extract(id),
    onSuccess: (res, id) => {
      toast.success(`Extracted ${res.data.requirements.length} requirement(s) from ${id}`);
      qc.invalidateQueries({ queryKey: ['queries'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Extraction failed');
    },
  });

  const matchMutation = useMutation({
    mutationFn: (id: string) => queriesApi.match(id),
    onSuccess: (res, id) => {
      const s = res.data.summary;
      toast.success(`Matching done for ${id}: ${s.matched} matched, ${s.missing} missing`);
      qc.invalidateQueries({ queryKey: ['queries'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Matching failed');
    },
  });

  const queries = data?.data || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={20} color="var(--primary-navy)" />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Insurer Queries</h1>
            <span className="badge badge-gray">{total} total</span>
            {claimId && <span className="badge badge-info">Filtered: {claimId}</span>}
          </div>
          <button id="upload-query-btn" className="btn btn-primary" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> Upload Query PDF
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select
              id="queries-status-filter"
              className="input"
              style={{ maxWidth: 200 }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Query ID</th>
                  <th>Patient</th>
                  <th>Claim</th>
                  <th>File</th>
                  <th>Extraction</th>
                  <th>Matching</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</td></tr>
                ) : queries.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No queries found</td></tr>
                ) : (
                  queries.map((q: Query) => (
                    <tr key={q._id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-teal)', fontSize: 12 }}>{q.queryId}</td>
                      <td style={{ fontSize: 12 }}>{q.patientId}</td>
                      <td style={{ fontSize: 12 }}>{q.claimId}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.originalFileName}>{q.originalFileName}</td>
                      <td><span className={`badge ${EXTRACT_BADGE[q.extractionStatus] || 'badge-gray'}`} style={{ fontSize: 10 }}>{q.extractionStatus}</span></td>
                      <td><span className={`badge ${EXTRACT_BADGE[q.matchingStatus] || 'badge-gray'}`} style={{ fontSize: 10 }}>{q.matchingStatus}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link to={`/queries/${q.queryId}`} className="btn btn-outline btn-sm" title="View details">
                            <Eye size={12} />
                          </Link>
                          {q.extractionStatus === 'PENDING' && (
                            <button
                              className="btn btn-sm btn-navy"
                              onClick={() => extractMutation.mutate(q.queryId)}
                              disabled={extractMutation.isPending}
                              title="Extract requirements"
                            >
                              <Activity size={12} />
                            </button>
                          )}
                          {q.extractionStatus === 'COMPLETED' && q.matchingStatus === 'PENDING' && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => matchMutation.mutate(q.queryId)}
                              disabled={matchMutation.isPending}
                              title="Run document matching"
                            >
                              <CheckCircle size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showUpload && <UploadQueryModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
