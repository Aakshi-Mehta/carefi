import { useQuery, useMutation } from '@tanstack/react-query';
import { Plug, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { integrationsApi } from '../api/endpoints';
import type { IntegrationStatus } from '../types';
import toast from 'react-hot-toast';

function IntegrationCard({
  name, provider, configured, mode, connected, details,
  onTest, testing, setupInstructions,
}: {
  name: string; provider: string; configured: boolean; mode: string;
  connected: boolean; details: string;
  onTest?: () => void; testing?: boolean;
  setupInstructions?: React.ReactNode;
}) {
  const isReallyConnected = configured && connected;
  const isSimulated = mode === 'mock' || mode === 'demo';
  const statusColor = isReallyConnected ? 'var(--success)' : configured || isSimulated ? 'var(--warning)' : 'var(--text-secondary)';
  const statusLabel = isReallyConnected ? 'Connected' : isSimulated ? 'Simulated' : configured ? 'Configured (not tested)' : 'Not Configured';

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Provider: {isSimulated ? 'Simulated' : provider}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: statusColor }}>
          {isReallyConnected ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {statusLabel}
        </div>
      </div>

      {isSimulated ? (
        <div className="notice-banner demo" style={{ marginBottom: 12 }}>
          <AlertCircle size={13} />
          <span>This integration is simulated. No live connection to {name} is active.</span>
        </div>
      ) : null}

      <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>Status Details</div>
        <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{details}</p>
      </div>

      {onTest && (
        <button
          id={`test-${name.toLowerCase().replace(/\s+/g, '-')}-btn`}
          className="btn btn-outline btn-sm"
          onClick={onTest}
          disabled={testing}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      )}

      {setupInstructions && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary-teal)' }}>
            Setup Instructions ↓
          </summary>
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: 'var(--text-primary)' }}>
            {setupInstructions}
          </div>
        </details>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.status().then((r) => r.data as IntegrationStatus),
  });

  const testDriveMutation = useMutation({
    mutationFn: () => integrationsApi.testDrive(),
    onSuccess: (res) => {
      const d = res.data as { connected: boolean; details: string };
      if (d.connected) toast.success(`Drive: ${d.details}`);
      else toast.error(`Drive: ${d.details}`);
      refetch();
    },
    onError: () => toast.error('Drive test failed'),
  });

  const testMetaMutation = useMutation({
    mutationFn: () => integrationsApi.testMeta(),
    onSuccess: (res) => {
      const d = res.data as { connected: boolean; details: string };
      if (d.connected) toast.success(`Meta: ${d.details}`);
      else toast.error(`Meta: ${d.details}`);
      refetch();
    },
    onError: () => toast.error('Meta test failed'),
  });

  const testEmailMutation = useMutation({
    mutationFn: () => integrationsApi.testEmail(),
    onSuccess: (res) => {
      const d = res.data as { connected: boolean; details: string };
      if (d.connected) toast.success(`Email: ${d.details}`);
      else toast.error(`Email: ${d.details}`);
      refetch();
    },
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading integrations…</div>;
  if (error || !data) {
    return (
      <div className="page-body">
        <div className="notice-banner error">
          <AlertCircle size={14} />
          <span>Could not load integration status. No connection state is being assumed.</span>
          <button className="btn btn-outline btn-sm" onClick={() => refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Plug size={20} color="var(--primary-navy)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Integrations</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Connected means a live API connection was verified. Simulated or unconfigured integrations are not connected to external services.
        </p>
        {data?.demoMode && (
          <div className="notice-banner demo" style={{ marginTop: 12 }}>
            ⚠️ This sandbox uses sample data. Check each integration below to see whether it has a verified live connection.
          </div>
        )}
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        <IntegrationCard
          name="Google Drive"
          provider={data?.drive?.provider || 'Simulated'}
          configured={data?.drive?.configured || false}
          mode={data?.drive?.mode || 'demo'}
          connected={data?.drive?.connected || false}
          details={data?.drive?.details || 'Not checked'}
          onTest={() => testDriveMutation.mutate()}
          testing={testDriveMutation.isPending}
          setupInstructions={
            <ol style={{ paddingLeft: 18 }}>
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-teal)' }}>Google Cloud Console <ExternalLink size={11} /></a></li>
              <li>Create a project and enable the Drive API (free — no billing required)</li>
              <li>Create OAuth 2.0 credentials (Web Application type)</li>
              <li>Add <code>http://localhost:3001/api/integrations/drive/callback</code> as redirect URI</li>
              <li>Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REDIRECT_URI</code> in your .env</li>
              <li>Set <code>DRIVE_PROVIDER=google</code></li>
              <li>Visit <code>/api/integrations/drive/auth</code> to authorize</li>
            </ol>
          }
        />

        <IntegrationCard
          name="Meta WhatsApp Cloud API"
          provider={data?.whatsapp?.provider || 'Simulated'}
          configured={data?.whatsapp?.configured || false}
          mode={data?.whatsapp?.mode || 'mock'}
          connected={data?.whatsapp?.connected || false}
          details={data?.whatsapp?.details || 'Not checked'}
          onTest={() => testMetaMutation.mutate()}
          testing={testMetaMutation.isPending}
          setupInstructions={
            <ol style={{ paddingLeft: 18 }}>
              <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-teal)' }}>Meta Developers <ExternalLink size={11} /></a> and create an account</li>
              <li>Create a new App → Add "WhatsApp" product</li>
              <li>Open "API Setup" to get the test phone number and temporary access token</li>
              <li>Add your personal number as a permitted test recipient (free — no business account needed)</li>
              <li>Copy the Phone Number ID and the temporary Access Token</li>
              <li>Create and get approval for a message template with one body text parameter</li>
              <li>Set <code>META_ACCESS_TOKEN</code>, <code>META_PHONE_NUMBER_ID</code>, <code>META_WEBHOOK_VERIFY_TOKEN</code>, <code>META_MESSAGE_TEMPLATE_NAME</code>, and <code>META_MESSAGE_TEMPLATE_LANGUAGE</code> in Render</li>
              <li>Set <code>WHATSAPP_PROVIDER=meta</code></li>
              <li>For webhooks: expose localhost with ngrok and configure <code>/api/webhooks/meta</code></li>
              <li><strong>Note:</strong> The approved template must contain one body placeholder (<code>{'{{1}}'}</code>) for the generated patient message. Test numbers only reach permitted recipients.</li>
            </ol>
          }
        />

        <IntegrationCard
          name="Email"
          provider={data?.email?.provider || 'Simulated'}
          configured={data?.email?.configured || false}
          mode={data?.email?.mode || 'mock'}
          connected={data?.email?.connected || false}
          details={data?.email?.details || 'Not checked'}
          onTest={() => testEmailMutation.mutate()}
          testing={testEmailMutation.isPending}
          setupInstructions={
            <div>
              <p style={{ marginBottom: 8 }}>For Gmail SMTP (free):</p>
              <ol style={{ paddingLeft: 18 }}>
                <li>Enable 2FA on your Gmail account</li>
                <li>Generate an App Password: Gmail Settings → Security → App Passwords</li>
                <li>Set <code>EMAIL_PROVIDER=smtp</code>, <code>EMAIL_HOST=smtp.gmail.com</code>, <code>EMAIL_PORT=587</code>, <code>EMAIL_USER=your@gmail.com</code>, <code>EMAIL_PASS=app-password</code></li>
              </ol>
            </div>
          }
        />
      </div>
    </div>
  );
}
