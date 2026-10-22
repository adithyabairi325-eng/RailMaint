export default function TractionDashboard({ onLogout, user }) {
  return (
    <div style={{ padding: '40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Traction / OHE Dashboard</h1>
      {user?.email && (
        <p style={{ color: '#4B5563', marginTop: '8px', fontSize: '15px' }}>
          Logged in as: <strong>{user.email}</strong> &bull; Role: <span style={{ color: '#F97316', fontWeight: '600' }}>Traction / OHE</span>
        </p>
      )}
      {onLogout && (
        <button
          onClick={onLogout}
          style={{
            marginTop: '20px',
            padding: '8px 16px',
            background: '#F97316',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Logout
        </button>
      )}
    </div>
  );
}
