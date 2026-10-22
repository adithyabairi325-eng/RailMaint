import { useState } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import EngineeringDashboard from './pages/EngineeringDashboard';
import TractionDashboard from './pages/TractionDashboard';
import SignalDashboard from './pages/SignalDashboard';
import PassengerDashboard from './pages/PassengerDashboard';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  const handleLoginSuccess = (userProfile, role) => {
    const verifiedRole = role || userProfile?.role || null;
    setCurrentUser(userProfile || null);
    setCurrentRole(verifiedRole);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentRole(null);
  };

  // If not logged in, show the Login page
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // When logged in, route to the corresponding dashboard based on the verified backend role
  switch (currentRole) {
    case 'engineering':
      return <EngineeringDashboard user={currentUser} onLogout={handleLogout} />;
    case 'traction':
      return <TractionDashboard user={currentUser} onLogout={handleLogout} />;
    case 'signal':
      return <SignalDashboard user={currentUser} onLogout={handleLogout} />;
    case 'passenger':
      return <PassengerDashboard user={currentUser} onLogout={handleLogout} />;
    case 'admin':
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    default:
      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          background: '#FFF7ED',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            padding: '36px 32px',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
            maxWidth: '440px'
          }}>
            <h2 style={{ color: '#DC2626', margin: '0 0 12px', fontSize: '20px' }}>Account Not Authorized</h2>
            <p style={{ color: '#4B5563', fontSize: '14px', lineHeight: 1.5, margin: '0 0 24px' }}>
              Your account does not have a recognized RailMaint role (role: <code>{String(currentRole || 'none')}</code>). Access is denied.
            </p>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                background: '#F97316',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Return to Login
            </button>
          </div>
        </div>
      );
  }
}

export default App;
