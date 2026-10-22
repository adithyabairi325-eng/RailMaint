import MaintenanceRequests from './MaintenanceRequests';

export default function TractionDashboard({ onLogout, user }) {
  return <MaintenanceRequests user={user} onLogout={onLogout} />;
}
