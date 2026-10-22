import MaintenanceRequests from './MaintenanceRequests';

export default function EngineeringDashboard({ onLogout, user }) {
  return <MaintenanceRequests user={user} onLogout={onLogout} />;
}
