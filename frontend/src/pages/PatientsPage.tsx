import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, ChevronRight, Mail, Phone } from 'lucide-react';
import { patientsApi, claimsApi, documentsApi } from '../api/endpoints';
import type { Patient } from '../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function PatientRow({ patient }: { patient: Patient }) {
  const { data: claimsData } = useQuery({
    queryKey: ['claims', patient.patientId],
    queryFn: () => claimsApi.list({ patientId: patient.patientId, page: 1 }).then((r) => r.data),
  });
  const { data: docsData } = useQuery({
    queryKey: ['documents', patient.patientId],
    queryFn: () => documentsApi.list({ patientId: patient.patientId, page: 1 }).then((r) => r.data),
  });
  return (
    <tr>
      <td>
        <Link to={`/patients/${patient.patientId}`} style={{ color: 'var(--primary-teal)', fontWeight: 600, textDecoration: 'none' }}>
          {patient.patientId}
        </Link>
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{patient.name}</div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
            <Phone size={11} /> {patient.phone}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
            <Mail size={11} /> {patient.email}
          </span>
        </div>
      </td>
      <td><span className="badge badge-navy">{claimsData?.pagination?.total ?? '—'} claims</span></td>
      <td><span className="badge badge-info">{docsData?.pagination?.total ?? '—'} docs</span></td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
        {formatDistanceToNow(new Date(patient.createdAt), { addSuffix: true })}
      </td>
      <td>
        <Link to={`/patients/${patient.patientId}`} className="btn btn-outline btn-sm">
          View <ChevronRight size={12} />
        </Link>
      </td>
    </tr>
  );
}

function CreatePatientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const mutation = useMutation({
    mutationFn: () => patientsApi.create(form),
    onSuccess: () => {
      toast.success('Patient created');
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to create patient');
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>New Patient</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="notice-banner demo" style={{ marginBottom: 16 }}>
            ⚠️ Use fictional patient details only. Do not enter real patient information.
          </div>
          {(['name', 'phone', 'email'] as const).map((field) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <label className="form-label">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input
                id={`new-patient-${field}`}
                type={field === 'email' ? 'email' : 'text'}
                className="input"
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            id="create-patient-submit"
            className="btn btn-primary"
            disabled={mutation.isPending || !form.name || !form.phone || !form.email}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Creating…' : 'Create Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, page],
    queryFn: () => patientsApi.list({ search: search || undefined, page }).then((r) => r.data),
  });

  const patients = data?.data || [];
  const total = data?.pagination?.total || 0;
  const pages = data?.pagination?.pages || 1;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={20} color="var(--primary-navy)" />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Patients</h1>
            <span className="badge badge-gray">{total} total</span>
          </div>
          <button id="new-patient-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Patient
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                id="patient-search"
                className="input"
                placeholder="Search by name, ID, email, phone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 32 }}
              />
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Claims</th>
                  <th>Documents</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading patients…</td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    {search ? 'No patients match your search.' : 'No patients yet. Create one or check that the API and database are running.'}
                  </td></tr>
                ) : (
                  patients.map((p: Patient) => <PatientRow key={p._id} patient={p} />)
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreatePatientModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
