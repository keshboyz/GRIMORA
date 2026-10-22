import API_BASE_URL from "../config/api";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Users,
  Star,
  Mail,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";

const API_URL = `${API_BASE_URL}/suppliers`;

const initialForm = {
  supplier_code: "",
  supplier_name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  tax_number: "",
  category: "",
  status: "active",
  performance_rating: "",
};

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to retrieve suppliers.");
      }

      const data = await response.json();
      setSuppliers(data);
    } catch {
      setError(
        "Could not connect to the GRIMORA API. Make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openModal = () => {
    setFormData(initialForm);
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    const payload = {
      ...formData,
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      tax_number: formData.tax_number || null,
      category: formData.category || null,
      performance_rating:
        formData.performance_rating === ""
          ? null
          : Number(formData.performance_rating),
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to create supplier."
        );
      }

      setShowModal(false);
      setFormData(initialForm);

      setSuccessMessage(
        `${data.supplier_name} was added successfully.`
      );

      await loadSuppliers();

      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const search = searchTerm.toLowerCase();

    return (
      supplier.supplier_name.toLowerCase().includes(search) ||
      supplier.supplier_code.toLowerCase().includes(search) ||
      (supplier.category || "").toLowerCase().includes(search) ||
      (supplier.contact_person || "")
        .toLowerCase()
        .includes(search)
    );
  });

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "active"
  ).length;

  const ratedSuppliers = suppliers.filter(
    (supplier) => supplier.performance_rating !== null
  );

  const averageRating =
    ratedSuppliers.length > 0
      ? (
          ratedSuppliers.reduce(
            (total, supplier) =>
              total + Number(supplier.performance_rating),
            0
          ) / ratedSuppliers.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="page-content suppliers-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MANAGEMENT</p>

          <h2>Suppliers</h2>

          <p className="page-description">
            Manage supplier records, contacts and performance.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openModal}
        >
          <Plus size={17} />
          Add Supplier
        </button>
      </div>

      {successMessage && (
        <div className="supplier-success-message">
          {successMessage}
        </div>
      )}

      <div className="supplier-summary-grid">
        <div className="supplier-summary-card">
          <div>
            <span>Total Suppliers</span>
            <strong>{suppliers.length}</strong>
          </div>

          <div className="supplier-summary-icon">
            <Users size={20} />
          </div>
        </div>

        <div className="supplier-summary-card">
          <div>
            <span>Active Suppliers</span>
            <strong>{activeSuppliers}</strong>
          </div>

          <div className="supplier-summary-icon">
            <Users size={20} />
          </div>
        </div>

        <div className="supplier-summary-card">
          <div>
            <span>Average Rating</span>
            <strong>{averageRating} / 5</strong>
          </div>

          <div className="supplier-summary-icon">
            <Star size={20} />
          </div>
        </div>
      </div>

      <div className="supplier-panel">
        <div className="supplier-toolbar">
          <div>
            <h3>Supplier Directory</h3>

            <p>
              {suppliers.length} supplier
              {suppliers.length === 1 ? "" : "s"} registered
            </p>
          </div>

          <div className="supplier-toolbar-actions">
            <div className="supplier-search">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <button
              className="refresh-button"
              onClick={loadSuppliers}
              title="Refresh suppliers"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="supplier-state">
            Loading suppliers...
          </div>
        )}

        {!loading && error && (
          <div className="supplier-state supplier-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredSuppliers.length === 0 && (
            <div className="supplier-state">
              No suppliers found.
            </div>
          )}

        {!loading &&
          !error &&
          filteredSuppliers.length > 0 && (
            <div className="supplier-table-wrapper">
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Category</th>
                    <th>Rating</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <div className="supplier-name-cell">
                          <div className="supplier-avatar">
                            {supplier.supplier_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {supplier.supplier_name}
                            </strong>

                            <span>
                              {supplier.supplier_code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="supplier-contact">
                          <strong>
                            {supplier.contact_person ||
                              "No contact person"}
                          </strong>

                          {supplier.email && (
                            <span>
                              <Mail size={12} />
                              {supplier.email}
                            </span>
                          )}

                          {supplier.phone && (
                            <span>
                              <Phone size={12} />
                              {supplier.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {supplier.category || "—"}
                      </td>

                      <td>
                        <div className="supplier-rating">
                          <Star size={14} />

                          <span>
                            {supplier.performance_rating
                              ? Number(
                                  supplier.performance_rating
                                ).toFixed(1)
                              : "Not rated"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`supplier-status ${
                            supplier.status === "active"
                              ? "supplier-active"
                              : "supplier-inactive"
                          }`}
                        >
                          {supplier.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showModal && (
        <div
          className="supplier-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="supplier-modal">
            <div className="supplier-modal-header">
              <div>
                <p className="eyebrow">
                  SUPPLIER MANAGEMENT
                </p>

                <h3>Add New Supplier</h3>

                <span>
                  Create a supplier record in GRIMORA.
                </span>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="supplier-form"
              onSubmit={handleSubmit}
            >
              {formError && (
                <div className="supplier-form-error">
                  {formError}
                </div>
              )}

              <div className="supplier-form-grid">
                <div className="form-field">
                  <label>Supplier Code *</label>

                  <input
                    name="supplier_code"
                    value={formData.supplier_code}
                    onChange={handleInputChange}
                    placeholder="SUP-002"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Supplier Name *</label>

                  <input
                    name="supplier_name"
                    value={formData.supplier_name}
                    onChange={handleInputChange}
                    placeholder="Supplier company name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Contact Person</label>

                  <input
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    placeholder="Contact person"
                  />
                </div>

                <div className="form-field">
                  <label>Email</label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="supplier@example.com"
                  />
                </div>

                <div className="form-field">
                  <label>Phone</label>

                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+254..."
                  />
                </div>

                <div className="form-field">
                  <label>Category</label>

                  <input
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Office Supplies"
                  />
                </div>

                <div className="form-field">
                  <label>Tax Number / PIN</label>

                  <input
                    name="tax_number"
                    value={formData.tax_number}
                    onChange={handleInputChange}
                    placeholder="Tax identification number"
                  />
                </div>

                <div className="form-field">
                  <label>Performance Rating</label>

                  <input
                    type="number"
                    name="performance_rating"
                    value={formData.performance_rating}
                    onChange={handleInputChange}
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="0 - 5"
                  />
                </div>

                <div className="form-field">
                  <label>Status</label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                <div className="form-field form-field-full">
                  <label>Address</label>

                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Supplier address"
                    rows="3"
                  />
                </div>
              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;