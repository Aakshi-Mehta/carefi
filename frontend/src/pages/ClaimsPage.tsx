import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Plus, Filter } from 'lucide-react';
import { claimsApi, patientsApi } from '../api/endpoints';
import type { Claim, Patient } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge-gray',
  QUERY_RECEIVED: 'badge-warning',
  DOCUMENTS_PENDING: 'badge-danger',
  UNDER_REVIEW: 'badge-info',
  APPROVED: 'badge-success',
  REJECTED: 'badge-danger',
  CLOSED: 'badge-gray',
};

function CreateClaimModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ patientId: '', insurer: '', hospital: '' });

  const { data: patientsData } = useQuery({
    queryKey: ['patients-all'],
    queryFn: () => patientsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => claimsApi.create(form),
    onSuccess: () => {
      toast.success('Claim created');
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create claim');
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>New Claim</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Patient</label>
            <select
              id="new-claim-patient"
              className="input"
              value={form.patientId}
              onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
            >
              <option value="">Select a patient…</option>
              {patientsData?.data?.map((p: Patient) => (
                <option key={p._id} value={p.patientId}>{p.name} ({p.patientId})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Insurer</label>
            <input id="new-claim-insurer" className="input" value={form.insurer} onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))} placeholder="e.g. Northstar Health" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Hospital</label>
            <input id="new-claim-hospital" className="input" value={form.hospital} onChange={(e) => setForm((f) => ({ ...f, hospital: e.target.value }))} placeholder="e.g. City General Hospital" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            id="create-claim-submit"
            className="btn btn-primary"
            disabled={mutation.isPending || !form.patientId || !form.insurer || !form.hospital}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Creating…' : 'Create Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['claims', statusFilter, page],
    queryFn: () => claimsApi.list({ status: statusFilter || undefined, page }).then((r) => r.data),
  });

  const claims = data?.data || [];
  const total = data?.pagination?.total || 0;
  const pages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} color="var(--primary-navy)" />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Claims</h1>
            <span className="badge badge-gray">{total} total</span>
          </div>
          <button id="new-claim-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Claim
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select
              id="claims-status-filter"
              className="input"
              style={{ maxWidth: 220 }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="QUERY_RECEIVED">Query Received</option>
              <option value="DOCUMENTS_PENDING">Documents Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Patient</th>
                  <th>Insurer</th>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</td></tr>
                ) : claims.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No claims found</td></tr>
                ) : (
                  claims.map((c: Claim) => (
                    <tr key={c._id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-teal)' }}>{c.claimId}</td>
                      <td>
                        <Link to={`/patients/${c.patientId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>
                          {c.patientId}
                        </Link>
                      </td>
                      <td>{c.insurer}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.hospital}</td>
                      <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{c.status.replace(/_/g, ' ')}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {format(new Date(c.updatedAt), 'dd MMM yyyy')}
                      </td>
                      <td>
                        <Link to={`/queries?claimId=${c.claimId}`} className="btn btn-outline btn-sm">
                          Queries
                        </Link>
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

      {showCreate && <CreateClaimModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
