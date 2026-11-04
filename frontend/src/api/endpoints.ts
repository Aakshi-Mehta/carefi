// Typed API wrappers for all endpoints

import api from './client';
import type {
  Patient, Claim, PatientDocument, Query, Requirement, Notification,
  AuditLog, DashboardStats, PaginatedResponse, IntegrationStatus, Match, User,
} from '../types';

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { userId: string; email: string; name: string; role: 'admin' | 'staff' | 'reviewer' } }>('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; role?: 'staff' | 'reviewer' }) =>
    api.post<{ user: User }>('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// ---- Dashboard ----
export const dashboardApi = {
  get: () => api.get<{ stats: DashboardStats; recentActivity: AuditLog[] }>('/dashboard'),
};

// ---- Patients ----
export const patientsApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Patient>>('/patients', { params }),
  get: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: { name: string; phone: string; email: string; dateOfBirth?: string }) =>
    api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<Patient>) =>
    api.patch<Patient>(`/patients/${id}`, data),
};

// ---- Claims ----
export const claimsApi = {
  list: (params?: { patientId?: string; status?: string; page?: number }) =>
    api.get<PaginatedResponse<Claim>>('/claims', { params }),
  get: (id: string) => api.get<Claim>(`/claims/${id}`),
  create: (data: { patientId: string; insurer: string; hospital: string; admissionDate?: string; dischargeDate?: string; totalAmount?: number }) =>
    api.post<Claim>('/claims', data),
};

// ---- Documents ----
export const documentsApi = {
  list: (params?: { patientId?: string; claimId?: string; category?: string; page?: number }) =>
    api.get<PaginatedResponse<PatientDocument>>('/documents', { params }),
  get: (id: string) => api.get<PatientDocument>(`/documents/${id}`),
  downloadFile: (id: string) => api.get<Blob>(`/documents/${id}/file`, { responseType: 'blob' }),
  upload: (formData: FormData) =>
    api.post<PatientDocument>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  verify: (id: string, status: 'VERIFIED' | 'REJECTED') =>
    api.post<PatientDocument>(`/documents/${id}/verify`, { status }),
};

export async function downloadDocumentFile(documentId: string, fileName: string): Promise<void> {
  const response = await documentsApi.downloadFile(documentId);
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// ---- Queries ----
export const queriesApi = {
  list: (params?: { patientId?: string; claimId?: string; status?: string; page?: number }) =>
    api.get<PaginatedResponse<Query>>('/queries', { params }),
  get: (id: string) =>
    api.get<{ query: Query; requirements: Requirement[]; matches: Match[] }>(`/queries/${id}`),
  upload: (formData: FormData) =>
    api.post<{
      query: Query;
      textPreview: string;
      automation: {
        status: 'COMPLETED' | 'NEEDS_REVIEW' | 'FAILED';
        requirementCount: number;
        matchedCount: number;
        missingCount: number;
        channels: Array<{ channel: 'WHATSAPP' | 'EMAIL'; status: string; errorMessage?: string }>;
        detail?: string;
      };
    }>('/queries', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  extract: (id: string) =>
    api.post<{ message: string; requirements: Requirement[] }>(`/queries/${id}/extract`),
  match: (id: string) =>
    api.post<{ message: string; matchResults: Match[]; summary: { matched: number; missing: number; total: number } }>(`/queries/${id}/match`),
  approve: (id: string) =>
    api.post<{ message: string }>(`/queries/${id}/approve`),
};

// ---- Notifications ----
export const notificationsApi = {
  generate: (queryId: string) =>
    api.post<{ message: string; notification: { message: string; missingDocuments: string[] }; readyToSend: boolean }>('/notifications/generate', { queryId }),
  send: (data: { queryId: string; channel: 'WHATSAPP' | 'EMAIL'; messageText: string; recipientPhone?: string; recipientEmail?: string }) =>
    api.post<{ notification: Notification; sendResult: unknown }>('/notifications/send', data),
  list: (params?: { patientId?: string; queryId?: string; channel?: string; submissionStatus?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Notification>>('/notifications', { params }),
  get: (id: string) => api.get<Notification>(`/notifications/${id}`),
};

// ---- Integrations ----
export const integrationsApi = {
  status: () => api.get<IntegrationStatus>('/integrations/status'),
  testDrive: () => api.post('/integrations/drive/test'),
  testMeta: () => api.post('/integrations/meta/test'),
  testEmail: () => api.post('/integrations/email/test'),
};

// ---- Activity ----
export const activityApi = {
  list: (params?: { page?: number; limit?: number; actor?: string; action?: string }) =>
    api.get<PaginatedResponse<AuditLog>>('/activity', { params }),
};
