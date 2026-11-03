import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { FolderOpen, Upload, Filter, CheckCircle, XCircle, Download } from 'lucide-react';
import { documentsApi, downloadDocumentFile, patientsApi, claimsApi } from '../api/endpoints';
import type { PatientDocument, Patient, Claim } from '../types';
import { DOCUMENT_CATEGORY_LABELS } from '../types';
import toast from 'react-hot-toast';

const VERIFY_BADGE: Record<string, string> = {
  VERIFIED: 'badge-success',
  UNVERIFIED: 'badge-warning',
  REJECTED: 'badge-danger',
};

const SOURCE_BADGE: Record<string, string> = {
  UPLOAD: 'badge-navy',
  GOOGLE_DRIVE: 'badge-info',
  DEMO: 'badge-gray',
};

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [patientId, setPatientId] = useState('');
  const [claimId, setClaimId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const { data: patientsData } = useQuery({
    queryKey: ['patients-all'],
    queryFn: () => patientsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const { data: claimsData } = useQuery({
    queryKey: ['claims-for-patient', patientId],
    queryFn: () => claimsApi.list({ patientId, limit: 50 } as Parameters<typeof claimsApi.list>[0]).then((r) => r.data),
    enabled: !!patientId,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0] || null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', patientId);
      if (claimId) formData.append('claimId', claimId);
      formData.append('category', category);
      if (notes) formData.append('notes', notes);
      return documentsApi.upload(formData);
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      qc.invalidateQueries({ queryKey: ['documents'] });
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
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Upload Document</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="notice-banner demo" style={{ marginBottom: 16 }}>
            ⚠️ Do not upload real patient data in demo mode.
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--primary-teal)' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '24px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? 'var(--mint)' : '#FAFBFC',
              marginBottom: 16,
              transition: 'all 0.15s',
            }}
          >
            <input {...getInputProps()} id="doc-upload-input" />
            <Upload size={24} color="var(--text-secondary)" style={{ margin: '0 auto 8px' }} />
            {file ? (
              <div>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{file.name}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {isDragActive ? 'Drop the file here' : 'Drag & drop or click to select'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>PDF, JPEG, PNG — max 20MB</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Patient *</label>
              <select id="doc-patient" className="input" value={patientId} onChange={(e) => { setPatientId(e.target.value); setClaimId(''); }}>
                <option value="">Select patient…</option>
                {patientsData?.data?.map((p: Patient) => (
                  <option key={p._id} value={p.patientId}>{p.name} ({p.patientId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Claim (optional)</label>
              <select id="doc-claim" className="input" value={claimId} onChange={(e) => setClaimId(e.target.value)} disabled={!patientId}>
                <option value="">No specific claim</option>
                {claimsData?.data?.map((c: Claim) => (
                  <option key={c._id} value={c.claimId}>{c.claimId} — {c.insurer}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Category *</label>
            <select id="doc-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category…</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Notes (optional)</label>
            <input id="doc-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            id="doc-upload-submit"
            className="btn btn-primary"
            disabled={mutation.isPending || !file || !patientId || !category}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LockerPage() {
  const [patientFilter, setPatientFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documents', patientFilter, categoryFilter, page],
    queryFn: () => documentsApi.list({
      patientId: patientFilter || undefined,
      category: categoryFilter || undefined,
      page,
    }).then((r) => r.data),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      documentsApi.verify(id, status),
    onSuccess: (_, vars) => {
      toast.success(`Document ${vars.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => toast.error('Verification failed'),
  });

  const docs = data?.data || [];
  const total = data?.pagination?.total || 0;
  const pages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={20} color="var(--primary-navy)" />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Patient Locker</h1>
            <span className="badge badge-gray">{total} documents</span>
          </div>
          <button id="upload-doc-btn" className="btn btn-primary" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> Upload Document
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <input
              id="locker-patient-filter"
              className="input"
              style={{ maxWidth: 180 }}
              placeholder="Filter by Patient ID…"
              value={patientFilter}
              onChange={(e) => { setPatientFilter(e.target.value); setPage(1); }}
            />
            <select
              id="locker-category-filter"
              className="input"
              style={{ maxWidth: 200 }}
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Patient</th>
                  <th>Category</th>
                  <th>Claim</th>
                  <th>Source</th>
                  <th>Size</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</td></tr>
                ) : docs.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No documents found. Upload one or adjust filters.</td></tr>
                ) : (
                  docs.map((d: PatientDocument) => (
                    <tr key={d._id}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                        title={d.fileName}>{d.fileName}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.patientId}</td>
                      <td><span className="badge badge-info" style={{ fontSize: 10 }}>{DOCUMENT_CATEGORY_LABELS[d.category] || d.category}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.claimId || '—'}</td>
                      <td><span className={`badge ${SOURCE_BADGE[d.source] || 'badge-gray'}`} style={{ fontSize: 10 }}>{d.source}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {d.fileSize ? `${(d.fileSize / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${VERIFY_BADGE[d.verificationStatus]}`} style={{ fontSize: 10 }}>
                          {d.verificationStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {d.storageFileId && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => downloadDocumentFile(d.documentId, d.fileName).catch(() => toast.error('Download failed'))}
                              title="Download original file"
                            >
                              <Download size={12} />
                            </button>
                          )}
                          {d.verificationStatus === 'UNVERIFIED' && (
                            <>
                            <button
                              className="btn btn-sm btn-outline"
                              style={{ color: 'var(--success)', borderColor: 'var(--success)', padding: '3px 8px' }}
                              onClick={() => verifyMutation.mutate({ id: d.documentId, status: 'VERIFIED' })}
                              title="Verify"
                            >
                              <CheckCircle size={12} />
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '3px 8px' }}
                              onClick={() => verifyMutation.mutate({ id: d.documentId, status: 'REJECTED' })}
                              title="Reject"
                            >
                              <XCircle size={12} />
                            </button>
                            </>
                          )}
                        </div>
                        {d.verificationStatus !== 'UNVERIFIED' && !d.storageFileId && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
