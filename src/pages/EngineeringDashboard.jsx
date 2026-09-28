export default function EngineeringDashboard({ onLogout }) {
  return (
    <div style={{ padding: '40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Engineering Dashboard</h1>
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
