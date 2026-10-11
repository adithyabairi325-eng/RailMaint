import { useState } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import EngineeringDashboard from './pages/EngineeringDashboard';
import TractionDashboard from './pages/TractionDashboard';
import SignalDashboard from './pages/SignalDashboard';
import PassengerDashboard from './pages/PassengerDashboard';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState('admin');

  const handleLoginSuccess = (roleOrUser, optionalRole) => {
    if (typeof roleOrUser === 'string') {
      setCurrentUser({ role: roleOrUser });
      setCurrentRole(roleOrUser);
    } else {
      setCurrentUser(roleOrUser || { role: optionalRole || 'admin' });
      setCurrentRole(optionalRole || 'admin');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // If not logged in, show the Login page
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // When logged in, route to the corresponding dashboard based on the selected role
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
    default:
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }
}

export default App;
