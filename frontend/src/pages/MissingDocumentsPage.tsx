import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { queriesApi } from '../api/endpoints';
import type { Query, Requirement } from '../types';
import { DOCUMENT_CATEGORY_LABELS } from '../types';

export default function MissingDocumentsPage() {
  // Fetch all queries with completed matching
  const { data: queriesData, isLoading: queriesLoading } = useQuery({
    queryKey: ['queries-all'],
    queryFn: () => queriesApi.list({ status: 'COMPLETED', limit: 100 } as Parameters<typeof queriesApi.list>[0]).then((r) => r.data),
  });

  // For each query, fetch requirements — collect all MISSING ones
  // We show missing requirements across all queries
  const { data: allQueriesDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['all-queries-detail', queriesData?.data?.map((q: Query) => q.queryId)],
    queryFn: async () => {
      const queries: Query[] = queriesData?.data || [];
      const results = await Promise.allSettled(
        queries
          .filter((q) => q.matchingStatus === 'COMPLETED')
          .map((q) => queriesApi.get(q.queryId).then((r) => r.data))
      );
      return results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<{ query: Query; requirements: Requirement[] }>).value);
    },
    enabled: !!queriesData?.data?.length,
  });

  const missingItems = (allQueriesDetail || []).flatMap((detail) =>
    (detail.requirements || [])
      .filter((r: Requirement) => r.status === 'MISSING')
      .map((r: Requirement) => ({ requirement: r, query: detail.query }))
  );

  const isLoading = queriesLoading || detailLoading;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={20} color="var(--danger)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Missing Documents</h1>
          {!isLoading && <span className="badge badge-danger">{missingItems.length} missing</span>}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Document requirements identified from insurer queries that have no matching patient documents.
        </p>
      </div>

      <div className="page-body">
        {!isLoading && missingItems.length === 0 && (
          <div className="card" style={{ padding: 60, textAlign: 'center' }}>
            <AlertCircle size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              No missing documents identified yet. Upload and process insurer query letters to identify missing requirements.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading missing documents…
          </div>
        )}

        {!isLoading && missingItems.length > 0 && (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Claim</th>
                    <th>Missing Document</th>
                    <th>Category</th>
                    <th>Query</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {missingItems.map(({ requirement, query }) => (
                    <tr key={requirement._id}>
                      <td style={{ fontSize: 12 }}>
                        <Link to={`/patients/${query.patientId}`} style={{ color: 'var(--primary-teal)', textDecoration: 'none', fontWeight: 600 }}>
                          {query.patientId}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{query.claimId}</td>
                      <td>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>"{requirement.originalText}"</span>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 10 }}>
                          {DOCUMENT_CATEGORY_LABELS[requirement.normalizedCategory] || requirement.normalizedCategory}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <Link to={`/queries/${query.queryId}`} style={{ color: 'var(--primary-teal)', textDecoration: 'none' }}>
                          {query.queryId}
                        </Link>
                      </td>
                      <td>
                        <div style={{
                          width: 60, height: 6, borderRadius: 3, background: 'var(--border)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round(requirement.confidence * 100)}%`,
                            background: requirement.confidence > 0.7 ? 'var(--success)' : requirement.confidence > 0.4 ? 'var(--warning)' : 'var(--danger)',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {Math.round(requirement.confidence * 100)}%
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-danger" style={{ fontSize: 10 }}>MISSING</span>
                      </td>
                      <td>
                        <Link to={`/queries/${query.queryId}`} className="btn btn-outline btn-sm">
                          <Link2 size={11} /> View Query
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
