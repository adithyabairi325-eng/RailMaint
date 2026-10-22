import MaintenanceRequests from './MaintenanceRequests';

export default function SignalDashboard({ onLogout, user }) {
  return <MaintenanceRequests user={user} onLogout={onLogout} />;
}
