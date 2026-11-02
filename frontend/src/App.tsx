import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import ClaimsPage from './pages/ClaimsPage';
import LockerPage from './pages/LockerPage';
import QueriesPage from './pages/QueriesPage';
import QueryDetailPage from './pages/QueryDetailPage';
import MissingDocumentsPage from './pages/MissingDocumentsPage';
import CommunicationsPage from './pages/CommunicationsPage';
import ActivityPage from './pages/ActivityPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/patients" element={<PatientsPage />} />
                    <Route path="/patients/:id" element={<PatientDetailPage />} />
                    <Route path="/claims" element={<ClaimsPage />} />
                    <Route path="/locker" element={<LockerPage />} />
                    <Route path="/queries" element={<QueriesPage />} />
                    <Route path="/queries/:id" element={<QueryDetailPage />} />
                    <Route path="/missing" element={<MissingDocumentsPage />} />
                    <Route path="/communications" element={<CommunicationsPage />} />
                    <Route path="/activity" element={<ActivityPage />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            borderRadius: '8px',
            border: '1px solid #E5EAF1',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
