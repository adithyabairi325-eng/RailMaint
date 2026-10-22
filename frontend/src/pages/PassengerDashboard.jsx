import MaintenanceRequests from './MaintenanceRequests';

export default function PassengerDashboard({ onLogout, user }) {
  return <MaintenanceRequests user={user} onLogout={onLogout} />;
}
