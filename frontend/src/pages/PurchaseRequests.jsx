import API_BASE_URL from "../config/api";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FilePlus2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import "./PurchaseRequests.css";

const API = `${API_BASE_URL}`;

const emptyForm = {
  department: "",
  required_date: "",
  purpose: "",
  priority: "normal",
};

const newItem = () => ({
  product_id: "",
  quantity: 1,
  estimated_unit_price: "",
  specifications: "",
});

const money = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const dateText = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
        dateStyle: "medium",
      })
    : "—";

const dateTimeText = (value) =>
  value
    ? new Date(value).toLocaleString("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function PurchaseRequests() {
  const { token, user, logout } = useAuth();

  const canCreate = [
    "admin",
    "procurement_officer",
    "requester",
  ].includes(user?.role);

  const canApprove = [
    "admin",
    "approver",
  ].includes(user?.role);

  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([newItem()]);
  const [rejectionReason, setRejectionReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Send the current JWT with every protected request.
  const apiFetch = useCallback(
    async (path, options = {}) => {
      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
      });

      if (response.status === 401) {
        logout();
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Request failed (${response.status}).`
        );
      }

      return data;
    },
    [token, logout]
  );

  const loadRequests = useCallback(async () => {
    const data = await apiFetch("/purchase-requests");
    setRequests(data);
    return data;
  }, [apiFetch]);

  const loadProducts = useCallback(async () => {
    const data = await apiFetch("/products");
    setProducts(data);
  }, [apiFetch]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadRequests(),
        loadProducts(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadRequests, loadProducts]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const showSuccess = (message) => {
    setSuccessMessage(message);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated = { ...item, [field]: value };

        if (field === "product_id") {
          const product = products.find(
            (entry) => entry.id === Number(value)
          );

          updated.estimated_unit_price =
            product?.unit_price ?? "";
        }

        return updated;
      })
    );
  };

  const openCreateModal = () => {
    if (!canCreate) return;

    setForm(emptyForm);
    setItems([newItem()]);
    setFormError("");
    setShowCreateModal(true);
  };

  const submitRequest = async (event) => {
    event.preventDefault();

    if (!canCreate) return;

    setFormError("");
    setSaving(true);

    try {
      const productIds = items.map((item) =>
        Number(item.product_id)
      );

      if (
        items.some(
          (item) =>
            !item.product_id ||
            Number(item.quantity) <= 0 ||
            item.estimated_unit_price === "" ||
            Number(item.estimated_unit_price) < 0
        )
      ) {
        throw new Error(
          "Please complete all purchase request items."
        );
      }

      if (new Set(productIds).size !== productIds.length) {
        throw new Error(
          "The same product cannot be added more than once."
        );
      }

      const payload = {
        department: form.department || null,
        required_date: form.required_date || null,
        purpose: form.purpose || null,
        priority: form.priority,
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          estimated_unit_price: Number(
            item.estimated_unit_price
          ),
          specifications: item.specifications || null,
        })),
      };

      const created = await apiFetch("/purchase-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowCreateModal(false);
      showSuccess(
        `${created.request_number} created successfully.`
      );

      await loadRequests();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (request) => {
    setSelectedRequest(request);
    setActionError("");
    setShowDetailsModal(true);
  };

  const closeDetails = () => {
    if (actionLoading) return;

    setShowDetailsModal(false);
    setSelectedRequest(null);
    setActionError("");
  };

  const approveRequest = async () => {
    if (
      !selectedRequest ||
      !canApprove ||
      actionLoading
    ) {
      return;
    }

    setActionLoading(true);
    setActionError("");

    try {
      // No approved_by field:
      // the backend reads the user from the JWT.
      const updated = await apiFetch(
        `/purchase-requests/${selectedRequest.id}/approve`,
        { method: "PATCH" }
      );

      setSelectedRequest(updated);
      showSuccess(
        `${updated.request_number} approved successfully.`
      );

      await loadRequests();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectRequest = async (event) => {
    event.preventDefault();

    if (
      !selectedRequest ||
      !canApprove ||
      actionLoading
    ) {
      return;
    }

    setActionError("");

    if (rejectionReason.trim().length < 3) {
      setActionError(
        "Please provide a valid rejection reason."
      );
      return;
    }

    setActionLoading(true);

    try {
      // Only the reason is supplied.
      // The backend determines who rejected it.
      const updated = await apiFetch(
        `/purchase-requests/${selectedRequest.id}/reject`,
        {
          method: "PATCH",
          body: JSON.stringify({
            rejection_reason: rejectionReason.trim(),
          }),
        }
      );

      setSelectedRequest(updated);
      setShowRejectModal(false);
      setRejectionReason("");

      showSuccess(`${updated.request_number} rejected.`);
      await loadRequests();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((request) => {
    const search = searchTerm.toLowerCase();

    return [
      request.request_number,
      request.requester_name,
      request.department,
      request.priority,
      request.status,
      request.purpose,
    ].some((value) =>
      String(value || "").toLowerCase().includes(search)
    );
  });

  const submittedCount = requests.filter(
    (request) => request.status === "submitted"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const urgentCount = requests.filter(
    (request) => request.priority === "urgent"
  ).length;

  const totalRequestedValue = requests.reduce(
    (total, request) =>
      total + Number(request.estimated_total || 0),
    0
  );

  const requestTotal = items.reduce(
    (total, item) =>
      total +
      Number(item.quantity || 0) *
        Number(item.estimated_unit_price || 0),
    0
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">PROCUREMENT</p>
          <h2>Purchase Requests</h2>
          <p className="page-description">
            Create, review and approve internal
            procurement requirements.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateModal}
          >
            <FilePlus2 size={16} />
            New Purchase Request
          </button>
        )}
      </div>

      {successMessage && (
        <div className="pr-success">
          <CheckCircle2 size={15} />
          {successMessage}
        </div>
      )}

      <div className="pr-summary-grid">
        <div className="pr-summary-card">
          <span>Total Requests</span>
          <strong>{requests.length}</strong>
          <FilePlus2 size={18} />
        </div>

        <div className="pr-summary-card">
          <span>Awaiting Approval</span>
          <strong>{submittedCount}</strong>
          <Clock3 size={18} />
        </div>

        <div className="pr-summary-card">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
          <CheckCircle2 size={18} />
        </div>

        <div className="pr-summary-card">
          <span>Requested Value</span>
          <strong>{money(totalRequestedValue)}</strong>
          <AlertCircle size={18} />
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="pr-urgent-message">
          {urgentCount} urgent purchase{" "}
          {urgentCount === 1
            ? "request requires"
            : "requests require"}{" "}
          attention.
        </div>
      )}

      <div className="pr-panel">
        <div className="pr-toolbar">
          <div>
            <h3>Purchase Request Register</h3>
            <p>
              {requests.length} recorded request
              {requests.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="pr-toolbar-actions">
            <div className="pr-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search requests..."
              />
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={loadPageData}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="pr-state">
            Loading purchase requests...
          </div>
        )}

        {!loading && error && (
          <div className="pr-state pr-error">{error}</div>
        )}

        {!loading &&
          !error &&
          filteredRequests.length === 0 && (
            <div className="pr-state">
              No purchase requests found.
            </div>
          )}

        {!loading &&
          !error &&
          filteredRequests.length > 0 && (
            <div className="pr-table-wrapper">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Department</th>
                    <th>Requester</th>
                    <th>Required</th>
                    <th>Priority</th>
                    <th>Items</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>
                          {request.request_number}
                        </strong>
                        <span className="pr-purpose">
                          {request.purpose ||
                            "No purpose specified"}
                        </span>
                      </td>

                      <td>{request.department || "—"}</td>
                      <td>{request.requester_name}</td>
                      <td>
                        {dateText(request.required_date)}
                      </td>

                      <td>
                        <span
                          className={`pr-priority pr-priority-${request.priority}`}
                        >
                          {request.priority}
                        </span>
                      </td>

                      <td>{request.items.length}</td>
                      <td>
                        {money(request.estimated_total)}
                      </td>

                      <td>
                        <span
                          className={`pr-status pr-status-${request.status}`}
                        >
                          {request.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="pr-view-button"
                          onClick={() =>
                            openDetails(request)
                          }
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* CREATE REQUEST MODAL */}
      {showCreateModal && canCreate && (
        <div
          className="pr-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              if (!saving) setShowCreateModal(false);
            }
          }}
        >
          <div className="pr-modal">
            <div className="pr-modal-header">
              <div>
                <p className="eyebrow">NEW REQUEST</p>
                <h3>Create Purchase Request</h3>
                <span>
                  Enter the procurement requirement and
                  requested items.
                </span>
              </div>

              <button
                type="button"
                className="pr-close"
                disabled={saving}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={submitRequest}
              className="pr-form"
            >
              {formError && (
                <div className="pr-form-error">
                  {formError}
                </div>
              )}

              <div className="pr-form-grid">
                <div className="pr-field">
                  <label>Department</label>
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleFormChange}
                    placeholder="e.g. Administration"
                  />
                </div>

                <div className="pr-field">
                  <label>Required Date</label>
                  <input
                    type="date"
                    name="required_date"
                    value={form.required_date}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="pr-field">
                  <label>Priority</label>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleFormChange}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="pr-field pr-field-full">
                  <label>Purpose</label>
                  <textarea
                    name="purpose"
                    value={form.purpose}
                    onChange={handleFormChange}
                    rows="2"
                    placeholder="Reason for this procurement request..."
                  />
                </div>
              </div>

              <div className="pr-items-heading">
                <div>
                  <h4>Requested Items</h4>
                  <p>
                    Add one or more products to the request.
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setItems((previous) => [
                      ...previous,
                      newItem(),
                    ])
                  }
                >
                  + Add Item
                </button>
              </div>

              <div className="pr-items">
                {items.map((item, index) => (
                  <div className="pr-item" key={index}>
                    <div className="pr-item-number">
                      Item {index + 1}
                    </div>

                    <div className="pr-item-grid">
                      <div className="pr-field pr-product-field">
                        <label>Product *</label>
                        <select
                          value={item.product_id}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "product_id",
                              event.target.value
                            )
                          }
                          required
                        >
                          <option value="">
                            Select product
                          </option>

                          {products.map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                            >
                              {product.product_code} —{" "}
                              {product.product_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pr-field">
                        <label>Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "quantity",
                              event.target.value
                            )
                          }
                          required
                        />
                      </div>

                      <div className="pr-field">
                        <label>
                          Estimated Unit Price *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimated_unit_price}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "estimated_unit_price",
                              event.target.value
                            )
                          }
                          required
                        />
                      </div>

                      <div className="pr-field pr-spec-field">
                        <label>Specifications</label>
                        <input
                          value={item.specifications}
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "specifications",
                              event.target.value
                            )
                          }
                          placeholder="Product specifications..."
                        />
                      </div>

                      <button
                        type="button"
                        className="pr-remove-item"
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems((previous) =>
                            previous.filter(
                              (_, i) => i !== index
                            )
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pr-request-total">
                <span>Estimated Request Total</span>
                <strong>{money(requestTotal)}</strong>
              </div>

              <div className="pr-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() =>
                    setShowCreateModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Submitting..."
                    : "Submit Purchase Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {showDetailsModal && selectedRequest && (
        <div className="pr-modal-overlay">
          <div className="pr-modal pr-details-modal">
            <div className="pr-modal-header">
              <div>
                <p className="eyebrow">
                  PURCHASE REQUEST
                </p>
                <h3>
                  {selectedRequest.request_number}
                </h3>
                <span>
                  Review request details and approval status.
                </span>
              </div>

              <button
                type="button"
                className="pr-close"
                onClick={closeDetails}
                disabled={actionLoading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="pr-details-content">
              {actionError && (
                <div className="pr-form-error">
                  {actionError}
                </div>
              )}

              <div className="pr-details-grid">
                <div>
                  <span>Department</span>
                  <strong>
                    {selectedRequest.department || "—"}
                  </strong>
                </div>

                <div>
                  <span>Requester</span>
                  <strong>
                    {selectedRequest.requester_name}
                  </strong>
                </div>

                <div>
                  <span>Request Date</span>
                  <strong>
                    {dateText(
                      selectedRequest.request_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Required Date</span>
                  <strong>
                    {dateText(
                      selectedRequest.required_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Priority</span>
                  <strong>
                    {selectedRequest.priority}
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {selectedRequest.status}
                  </strong>
                </div>
              </div>

              <div className="pr-details-section">
                <span className="pr-detail-label">
                  Purpose
                </span>
                <p>
                  {selectedRequest.purpose ||
                    "No purpose specified."}
                </p>
              </div>

              <div className="pr-details-section">
                <span className="pr-detail-label">
                  Requested Items
                </span>

                <div className="pr-details-table-wrapper">
                  <table className="pr-details-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedRequest.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>
                              {item.product_name}
                            </strong>
                            <span>
                              {item.product_code}
                            </span>
                          </td>
                          <td>{item.quantity}</td>
                          <td>
                            {money(
                              item.estimated_unit_price
                            )}
                          </td>
                          <td>
                            {money(item.estimated_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pr-details-total">
                <span>Estimated Total</span>
                <strong>
                  {money(
                    selectedRequest.estimated_total
                  )}
                </strong>
              </div>

              {selectedRequest.status === "approved" && (
                <div className="pr-decision-box pr-approved-box">
                  <CheckCircle2 size={17} />
                  <div>
                    <strong>Request Approved</strong>
                    <span>
                      Approved{" "}
                      {dateTimeText(
                        selectedRequest.approved_at
                      )}
                    </span>
                  </div>
                </div>
              )}

              {selectedRequest.status === "rejected" && (
                <div className="pr-decision-box pr-rejected-box">
                  <XCircle size={17} />
                  <div>
                    <strong>Request Rejected</strong>
                    <span>
                      {selectedRequest.rejection_reason}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pr-details-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDetails}
                disabled={actionLoading}
              >
                Close
              </button>

              {canApprove &&
                selectedRequest.status === "submitted" && (
                  <>
                    <button
                      type="button"
                      className="pr-reject-button"
                      onClick={() => {
                        setActionError("");
                        setRejectionReason("");
                        setShowRejectModal(true);
                      }}
                      disabled={actionLoading}
                    >
                      <XCircle size={15} />
                      Reject
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={approveRequest}
                      disabled={actionLoading}
                    >
                      <Check size={15} />
                      {actionLoading
                        ? "Processing..."
                        : "Approve Request"}
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectModal &&
        selectedRequest &&
        canApprove && (
          <div className="pr-modal-overlay pr-reject-overlay">
            <div className="pr-reject-modal">
              <div className="pr-modal-header">
                <div>
                  <p className="eyebrow">
                    REJECT REQUEST
                  </p>
                  <h3>
                    {selectedRequest.request_number}
                  </h3>
                  <span>
                    Provide the reason for rejecting this
                    request.
                  </span>
                </div>

                <button
                  type="button"
                  className="pr-close"
                  onClick={() =>
                    setShowRejectModal(false)
                  }
                  disabled={actionLoading}
                >
                  <X size={18} />
                </button>
              </div>

              <form
                className="pr-form"
                onSubmit={rejectRequest}
              >
                {actionError && (
                  <div className="pr-form-error">
                    {actionError}
                  </div>
                )}

                <div className="pr-field">
                  <label>Rejection Reason *</label>
                  <textarea
                    rows="5"
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    placeholder="Explain why this request is being rejected..."
                    required
                  />
                </div>

                <div className="pr-form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionLoading}
                    onClick={() =>
                      setShowRejectModal(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="pr-reject-button"
                    disabled={actionLoading}
                  >
                    <XCircle size={15} />
                    {actionLoading
                      ? "Rejecting..."
                      : "Reject Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

export default PurchaseRequests;
