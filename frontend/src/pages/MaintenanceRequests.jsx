import { useState, useEffect, useCallback } from "react";
import { auth } from "../firebase/firebaseConfig";
import "./MaintenanceRequests.css";

const ASSET_CATEGORIES = ["Track", "Signal", "Electrical", "Mechanical", "Bridge"];
const DEPARTMENTS = ["Engineering", "Traction/OHE", "Signal & Telecom"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = [
  "Submitted",
  "Under Review",
  "Approved",
  "Scheduled",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

// Helper to format ISO dates into friendly readable strings
function formatDate(dateInput) {
  if (!dateInput) return "—";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPriorityBadgeClass(pri) {
  switch (String(pri).toLowerCase()) {
    case "critical":
      return "mr-badge mr-pri-critical";
    case "high":
      return "mr-badge mr-pri-high";
    case "medium":
      return "mr-badge mr-pri-medium";
    case "low":
      return "mr-badge mr-pri-low";
    default:
      return "mr-badge";
  }
}

function getStatusBadgeClass(st) {
  switch (String(st).toLowerCase()) {
    case "submitted":
      return "mr-badge mr-st-submitted";
    case "under review":
      return "mr-badge mr-st-under-review";
    case "approved":
      return "mr-badge mr-st-approved";
    case "scheduled":
      return "mr-badge mr-st-scheduled";
    case "in progress":
      return "mr-badge mr-st-in-progress";
    case "completed":
      return "mr-badge mr-st-completed";
    case "rejected":
      return "mr-badge mr-st-rejected";
    case "cancelled":
      return "mr-badge mr-st-cancelled";
    default:
      return "mr-badge";
  }
}

export default function MaintenanceRequests({ user, onLogout }) {
  // Determine default department based on user role
  const getInitialDept = () => {
    const role = String(user?.role || "").toLowerCase();
    if (role === "traction") return "Traction/OHE";
    if (role === "signal") return "Signal & Telecom";
    return "Engineering";
  };

  // State: List, Filtering, Loading
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    assetCategory: "Track",
    location: "",
    department: getInitialDept(),
    issueType: "",
    description: "",
    priority: "Medium",
    estimatedDuration: "60",
    requiredResources: "",
    preferredDateTime: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState("");
  const [alertError, setAlertError] = useState("");

  // Modal State for Viewing Request Details & Status Update
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [statusUpdateNote, setStatusUpdateNote] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Helper to obtain fresh Firebase ID token
  const getIdToken = async () => {
    if (!auth?.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  // Fetch requests from MongoDB Atlas
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setListError("");
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("No active sign-in session found.");
      }

      const queryParams = new URLSearchParams();
      if (filterDept) queryParams.set("department", filterDept);
      if (filterPriority) queryParams.set("priority", filterPriority);
      if (filterStatus) queryParams.set("status", filterStatus);
      if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());

      const res = await fetch(`/api/maintenance-requests?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch requests (HTTP ${res.status})`);
      }

      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Fetch requests failed:", err);
      setListError(err.message || "Unable to load maintenance requests.");
    } finally {
      setIsLoading(false);
    }
  }, [filterDept, filterPriority, filterStatus, searchQuery]);

  // Initial load and filter change trigger
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Form input validation
  const validateForm = () => {
    const errors = {};
    if (!formData.assetCategory) errors.assetCategory = "Asset category is required.";
    if (!formData.location.trim()) errors.location = "Location / track section is required.";
    if (!formData.department) errors.department = "Department is required.";
    if (!formData.issueType.trim()) errors.issueType = "Issue type is required.";
    if (!formData.description.trim()) errors.description = "Short description is required.";
    if (!formData.priority) errors.priority = "Priority is required.";
    if (!formData.estimatedDuration || Number(formData.estimatedDuration) <= 0) {
      errors.estimatedDuration = "Duration must be at least 1 minute.";
    }
    if (!formData.requiredResources.trim()) {
      errors.requiredResources = "Required team/resources is required.";
    }
    if (!formData.preferredDateTime) {
      errors.preferredDateTime = "Preferred maintenance date and time is required.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Form Submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setAlertSuccess("");
    setAlertError("");

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication required. Please log in again.");

      const res = await fetch("/api/maintenance-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create maintenance request.");
      }

      setAlertSuccess(`Maintenance request ${result.request?.requestId || ""} created successfully!`);
      // Reset form
      setFormData({
        assetCategory: "Track",
        location: "",
        department: getInitialDept(),
        issueType: "",
        description: "",
        priority: "Medium",
        estimatedDuration: "60",
        requiredResources: "",
        preferredDateTime: "",
      });
      setShowForm(false);
      // Reload table
      fetchRequests();
    } catch (err) {
      console.error("Create request error:", err);
      setAlertError(err.message || "An unexpected error occurred while saving the request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = (req) => {
    setSelectedRequest(req);
    setStatusUpdateNote("");
    setTargetStatus("");
  };

  // Handle Status Update
  const handleStatusUpdate = async (newStatusValue) => {
    if (!selectedRequest || !newStatusValue) return;
    setIsUpdatingStatus(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication session expired.");

      const res = await fetch(`/api/maintenance-requests/${selectedRequest._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatusValue,
          note: statusUpdateNote,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update status.");
      }

      setAlertSuccess(`Request ${selectedRequest.requestId} status updated to '${newStatusValue}'.`);
      setSelectedRequest(result.request);
      fetchRequests();
    } catch (err) {
      console.error("Status update error:", err);
      alert(err.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Determine allowed next statuses for current user
  const userRole = String(user?.role || "").toLowerCase();
  const getNextAvailableStatuses = (currentSt) => {
    if (["Completed", "Rejected", "Cancelled"].includes(currentSt)) return [];

    if (userRole === "admin") {
      switch (currentSt) {
        case "Submitted":
          return ["Under Review", "Approved", "Rejected", "Cancelled"];
        case "Under Review":
          return ["Approved", "Rejected", "Cancelled"];
        case "Approved":
          return ["Scheduled", "In Progress", "Cancelled"];
        case "Scheduled":
          return ["In Progress", "Cancelled"];
        case "In Progress":
          return ["Completed", "Cancelled"];
        default:
          return [];
      }
    } else {
      // Department team or Creator
      switch (currentSt) {
        case "Submitted":
        case "Under Review":
          return ["Cancelled"];
        case "Approved":
        case "Scheduled":
          return ["In Progress"];
        case "In Progress":
          return ["Completed"];
        default:
          return [];
      }
    }
  };

  return (
    <div className="mr-container">
      {/* Top Header */}
      <header className="mr-header">
        <div className="mr-title-wrap">
          <h1>Maintenance Requests</h1>
          <div className="mr-user-pill">
            <span>Signed in as: <strong>{user?.email || "User"}</strong></span>
            <span className="mr-role-badge">{user?.role || "user"}</span>
          </div>
        </div>

        <div className="mr-header-actions">
          <button
            type="button"
            className={`mr-btn ${showForm ? "" : "mr-btn-primary"}`}
            onClick={() => {
              setShowForm((prev) => !prev);
              setAlertSuccess("");
              setAlertError("");
            }}
          >
            {showForm ? "Hide Form" : "+ Create Request"}
          </button>
          <button
            type="button"
            className="mr-btn"
            onClick={fetchRequests}
            disabled={isLoading}
            title="Refresh requests list"
          >
            {isLoading ? <span className="mr-spinner" /> : "↻ Refresh"}
          </button>
          {onLogout && (
            <button
              type="button"
              className="mr-btn mr-btn-danger"
              onClick={onLogout}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Global Alerts */}
      {alertSuccess && (
        <div className="mr-alert mr-alert-success" role="alert">
          <span>{alertSuccess}</span>
          <button
            type="button"
            className="mr-alert-close"
            onClick={() => setAlertSuccess("")}
            aria-label="Dismiss alert"
          >
            &times;
          </button>
        </div>
      )}

      {alertError && (
        <div className="mr-alert mr-alert-error" role="alert">
          <span>{alertError}</span>
          <button
            type="button"
            className="mr-alert-close"
            onClick={() => setAlertError("")}
            aria-label="Dismiss alert"
          >
            &times;
          </button>
        </div>
      )}

      {/* Maintenance Request Form */}
      {showForm && (
        <section className="mr-card">
          <div className="mr-form-header">
            <h2>New Maintenance Request</h2>
            <p>Submit a railway maintenance request to be scheduled and approved.</p>
          </div>

          <form onSubmit={handleFormSubmit} noValidate>
            <div className="mr-form-grid">
              {/* Asset Category */}
              <div className="mr-field">
                <label htmlFor="mr-asset-cat">
                  Asset Category<span className="req">*</span>
                </label>
                <select
                  id="mr-asset-cat"
                  className="mr-select"
                  value={formData.assetCategory}
                  onChange={(e) => setFormData({ ...formData, assetCategory: e.target.value })}
                >
                  {ASSET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {formErrors.assetCategory && (
                  <span className="mr-field-error">{formErrors.assetCategory}</span>
                )}
              </div>

              {/* Location / Track Section */}
              <div className="mr-field">
                <label htmlFor="mr-location">
                  Location / Track Section<span className="req">*</span>
                </label>
                <input
                  id="mr-location"
                  type="text"
                  className="mr-input"
                  placeholder="e.g. Section KM 42+200, Main Line"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
                {formErrors.location && (
                  <span className="mr-field-error">{formErrors.location}</span>
                )}
              </div>

              {/* Department */}
              <div className="mr-field">
                <label htmlFor="mr-department">
                  Department<span className="req">*</span>
                </label>
                <select
                  id="mr-department"
                  className="mr-select"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  disabled={userRole !== "admin" && DEPARTMENTS.includes(getInitialDept())}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {formErrors.department && (
                  <span className="mr-field-error">{formErrors.department}</span>
                )}
              </div>

              {/* Priority */}
              <div className="mr-field">
                <label htmlFor="mr-priority">
                  Priority<span className="req">*</span>
                </label>
                <select
                  id="mr-priority"
                  className="mr-select"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {PRIORITIES.map((pri) => (
                    <option key={pri} value={pri}>
                      {pri}
                    </option>
                  ))}
                </select>
                {formErrors.priority && (
                  <span className="mr-field-error">{formErrors.priority}</span>
                )}
              </div>

              {/* Issue Type */}
              <div className="mr-field">
                <label htmlFor="mr-issue-type">
                  Issue Type<span className="req">*</span>
                </label>
                <input
                  id="mr-issue-type"
                  type="text"
                  className="mr-input"
                  placeholder="e.g. Rail crack, Signal failure, OHE wire sag"
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                />
                {formErrors.issueType && (
                  <span className="mr-field-error">{formErrors.issueType}</span>
                )}
              </div>

              {/* Estimated Duration */}
              <div className="mr-field">
                <label htmlFor="mr-duration">
                  Estimated Duration (Minutes)<span className="req">*</span>
                </label>
                <input
                  id="mr-duration"
                  type="number"
                  min="5"
                  step="5"
                  className="mr-input"
                  placeholder="e.g. 60"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                />
                {formErrors.estimatedDuration && (
                  <span className="mr-field-error">{formErrors.estimatedDuration}</span>
                )}
              </div>

              {/* Preferred Date & Time */}
              <div className="mr-field">
                <label htmlFor="mr-datetime">
                  Preferred Date & Time<span className="req">*</span>
                </label>
                <input
                  id="mr-datetime"
                  type="datetime-local"
                  className="mr-input"
                  value={formData.preferredDateTime}
                  onChange={(e) => setFormData({ ...formData, preferredDateTime: e.target.value })}
                />
                {formErrors.preferredDateTime && (
                  <span className="mr-field-error">{formErrors.preferredDateTime}</span>
                )}
              </div>

              {/* Required Resources */}
              <div className="mr-field">
                <label htmlFor="mr-resources">
                  Required Team / Resources<span className="req">*</span>
                </label>
                <input
                  id="mr-resources"
                  type="text"
                  className="mr-input"
                  placeholder="e.g. Gang of 4 technicians, Weld machine, Tower wagon"
                  value={formData.requiredResources}
                  onChange={(e) => setFormData({ ...formData, requiredResources: e.target.value })}
                />
                {formErrors.requiredResources && (
                  <span className="mr-field-error">{formErrors.requiredResources}</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mr-field" style={{ marginBottom: "18px" }}>
              <label htmlFor="mr-desc">
                Short Description<span className="req">*</span>
              </label>
              <textarea
                id="mr-desc"
                className="mr-textarea"
                placeholder="Provide a clear description of the defect, observation, or maintenance need..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              {formErrors.description && (
                <span className="mr-field-error">{formErrors.description}</span>
              )}
            </div>

            <div className="mr-form-actions">
              <button
                type="button"
                className="mr-btn"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="mr-btn mr-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="mr-spinner" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  "Submit Maintenance Request"
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Toolbar & Filters */}
      <div className="mr-toolbar">
        <div className="mr-filters-wrap">
          <input
            type="search"
            className="mr-search-input"
            placeholder="Search by ID, location, or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="mr-filter-select"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            className="mr-filter-select"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="mr-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(filterDept || filterPriority || filterStatus || searchQuery) && (
            <button
              type="button"
              className="mr-btn mr-btn-sm"
              onClick={() => {
                setFilterDept("");
                setFilterPriority("");
                setFilterStatus("");
                setSearchQuery("");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="mr-stats-bar">
          <span>Total Records: <strong>{requests.length}</strong></span>
        </div>
      </div>

      {/* Requests Table */}
      <div className="mr-table-wrap">
        {isLoading ? (
          <div className="mr-loading">
            <span className="mr-spinner" style={{ borderTopColor: "#F97316", width: "24px", height: "24px" }} />
            <p style={{ marginTop: "12px" }}>Loading maintenance requests from MongoDB Atlas...</p>
          </div>
        ) : listError ? (
          <div className="mr-error-box">
            <p style={{ color: "#DC2626", fontWeight: "600" }}>{listError}</p>
            <button
              type="button"
              className="mr-btn mr-btn-sm mr-btn-primary"
              style={{ marginTop: "12px" }}
              onClick={fetchRequests}
            >
              Retry
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="mr-empty">
            <div className="mr-empty-icon">📋</div>
            <h3>No Maintenance Requests Found</h3>
            <p>
              {filterDept || filterPriority || filterStatus || searchQuery
                ? "No requests match the selected filters. Try resetting the filters."
                : "No maintenance requests have been recorded yet. Click below to submit one."}
            </p>
            <button
              type="button"
              className="mr-btn mr-btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Create First Request
            </button>
          </div>
        ) : (
          <table className="mr-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Asset</th>
                <th>Location</th>
                <th>Department</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submission Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id}>
                  <td className="mr-req-id">{req.requestId}</td>
                  <td>
                    <strong>{req.assetCategory}</strong>
                    <div style={{ fontSize: "11px", color: "#6B7280" }}>{req.issueType}</div>
                  </td>
                  <td>{req.location}</td>
                  <td>{req.department}</td>
                  <td>
                    <span className={getPriorityBadgeClass(req.priority)}>
                      {req.priority}
                    </span>
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(req.status)}>
                      {req.status}
                    </span>
                  </td>
                  <td>{formatDate(req.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="mr-btn mr-btn-sm"
                      onClick={() => handleOpenDetails(req)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details & Status Modal */}
      {selectedRequest && (
        <div
          className="mr-modal-backdrop"
          onClick={() => setSelectedRequest(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="mr-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mr-modal-header">
              <div>
                <h2>{selectedRequest.requestId}</h2>
                <div style={{ marginTop: "4px" }}>
                  <span className={getStatusBadgeClass(selectedRequest.status)}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="mr-modal-close"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <div className="mr-modal-body">
              <dl className="mr-detail-grid">
                <div className="mr-detail-item">
                  <dt>Asset Category</dt>
                  <dd>{selectedRequest.assetCategory}</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Location / Section</dt>
                  <dd>{selectedRequest.location}</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Department</dt>
                  <dd>{selectedRequest.department}</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Priority</dt>
                  <dd>
                    <span className={getPriorityBadgeClass(selectedRequest.priority)}>
                      {selectedRequest.priority}
                    </span>
                  </dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Estimated Duration</dt>
                  <dd>{selectedRequest.estimatedDuration} minutes</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Preferred Date/Time</dt>
                  <dd>{formatDate(selectedRequest.preferredDateTime)}</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Submitted By</dt>
                  <dd>{selectedRequest.createdBy?.email || "Unknown"}</dd>
                </div>
                <div className="mr-detail-item">
                  <dt>Submission Date</dt>
                  <dd>{formatDate(selectedRequest.createdAt)}</dd>
                </div>
              </dl>

              <div className="mr-modal-section-title">Required Team / Resources</div>
              <div className="mr-modal-desc-box">{selectedRequest.requiredResources}</div>

              <div className="mr-modal-section-title">Short Description</div>
              <div className="mr-modal-desc-box">{selectedRequest.description}</div>

              {/* Status Management Section */}
              <div className="mr-status-update-box">
                <div className="mr-modal-section-title" style={{ marginTop: 0 }}>
                  Manage Request Status
                </div>
                {getNextAvailableStatuses(selectedRequest.status).length > 0 ? (
                  <div>
                    <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 10px" }}>
                      Current status: <strong>{selectedRequest.status}</strong>. Choose a new status to progress this request:
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                      {getNextAvailableStatuses(selectedRequest.status).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`mr-btn mr-btn-sm ${targetStatus === st ? "mr-btn-primary" : ""}`}
                          onClick={() => setTargetStatus(st)}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    {targetStatus && (
                      <div>
                        <input
                          type="text"
                          className="mr-input"
                          style={{ marginBottom: "10px" }}
                          placeholder="Optional note for this status change..."
                          value={statusUpdateNote}
                          onChange={(e) => setStatusUpdateNote(e.target.value)}
                        />
                        <button
                          type="button"
                          className="mr-btn mr-btn-primary mr-btn-sm"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusUpdate(targetStatus)}
                        >
                          {isUpdatingStatus ? (
                            <>
                              <span className="mr-spinner" /> Updating...
                            </>
                          ) : (
                            `Confirm: Mark as ${targetStatus}`
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#6B7280", fontStyle: "italic" }}>
                    {["Completed", "Rejected", "Cancelled"].includes(selectedRequest.status)
                      ? `This request is ${selectedRequest.status} and cannot be modified further.`
                      : "You do not have permission to transition the status of this request."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
