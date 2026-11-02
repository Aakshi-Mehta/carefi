export default function SettingsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, color: '#1F2937' }}>Settings</h1>
        <p style={{ margin: '0 0 24px', color: '#6B7280' }}>
          Manage the workspace configuration for alerts, providers, and integrations.
        </p>

        <div
          style={{
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#111827' }}>General</h2>
              <div style={{ color: '#4B5563' }}>Application defaults and operational preferences.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Region</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: '#111827' }}>US East</div>
              </div>

              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Theme</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: '#111827' }}>Default</div>
              </div>

              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Notifications</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: '#111827' }}>Enabled</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
