
import { useEffect, useState } from "react";
import {
  Box,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Wallet,
  X,
} from "lucide-react";

import API_BASE_URL from "../config/api";

const API_URL = `${API_BASE_URL}/products`;

const initialForm = {
  product_code: "",
  product_name: "",
  description: "",
  category: "",
  unit_of_measure: "",
  unit_price: "",
  reorder_level: "",
  is_active: true,
};

function Products() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to retrieve products.");
      }

      const data = await response.json();
      setProducts(data);
    } catch {
      setError(
        "Could not connect to the GRIMORA API. Make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
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
      description: formData.description || null,
      category: formData.category || null,
      unit_price: Number(formData.unit_price),
      reorder_level: Number(formData.reorder_level),
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
        if (typeof data.detail === "string") {
          throw new Error(data.detail);
        }

        throw new Error("Unable to create product.");
      }

      setShowModal(false);
      setFormData(initialForm);

      setSuccessMessage(
        `${data.product_name} was added successfully.`
      );

      await loadProducts();

      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.toLowerCase();

    return (
      product.product_name.toLowerCase().includes(search) ||
      product.product_code.toLowerCase().includes(search) ||
      (product.category || "").toLowerCase().includes(search)
    );
  });

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const totalCatalogValue = products.reduce(
    (total, product) => total + Number(product.unit_price),
    0
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="page-content products-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MANAGEMENT</p>
          <h2>Products</h2>

          <p className="page-description">
            Manage procurement items, pricing and reorder levels.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openModal}
        >
          <Plus size={17} />
          Add Product
        </button>
      </div>

      {successMessage && (
        <div className="supplier-success-message">
          {successMessage}
        </div>
      )}

      <div className="product-summary-grid">
        <div className="product-summary-card">
          <div>
            <span>Total Products</span>
            <strong>{products.length}</strong>
          </div>

          <div className="product-summary-icon">
            <Box size={20} />
          </div>
        </div>

        <div className="product-summary-card">
          <div>
            <span>Active Products</span>
            <strong>{activeProducts}</strong>
          </div>

          <div className="product-summary-icon">
            <Tag size={20} />
          </div>
        </div>

        <div className="product-summary-card">
          <div>
            <span>Catalog Unit Value</span>
            <strong>{formatCurrency(totalCatalogValue)}</strong>
          </div>

          <div className="product-summary-icon">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      <div className="product-panel">
        <div className="product-toolbar">
          <div>
            <h3>Product Catalogue</h3>

            <p>
              {products.length} product
              {products.length === 1 ? "" : "s"} registered
            </p>
          </div>

          <div className="product-toolbar-actions">
            <div className="product-search">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <button
              className="refresh-button"
              onClick={loadProducts}
              title="Refresh products"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="product-state">
            Loading products...
          </div>
        )}

        {!loading && error && (
          <div className="product-state product-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredProducts.length === 0 && (
            <div className="product-state">
              No products found.
            </div>
          )}

        {!loading &&
          !error &&
          filteredProducts.length > 0 && (
            <div className="product-table-wrapper">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Unit Price</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-avatar">
                            <Box size={15} />
                          </div>

                          <div>
                            <strong>
                              {product.product_name}
                            </strong>

                            <span>
                              {product.product_code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {product.category || "—"}
                      </td>

                      <td>
                        {product.unit_of_measure}
                      </td>

                      <td className="product-price">
                        {formatCurrency(
                          Number(product.unit_price)
                        )}
                      </td>

                      <td>
                        {product.reorder_level}
                      </td>

                      <td>
                        <span
                          className={`product-status ${
                            product.is_active
                              ? "product-active"
                              : "product-inactive"
                          }`}
                        >
                          {product.is_active
                            ? "Active"
                            : "Inactive"}
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
                  PRODUCT MANAGEMENT
                </p>

                <h3>Add New Product</h3>

                <span>
                  Add a procurement item to the GRIMORA catalogue.
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
                  <label>Product Code *</label>

                  <input
                    name="product_code"
                    value={formData.product_code}
                    onChange={handleInputChange}
                    placeholder="PRD-004"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Product Name *</label>

                  <input
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleInputChange}
                    placeholder="Product name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Category</label>

                  <input
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="ICT Equipment"
                  />
                </div>

                <div className="form-field">
                  <label>Unit of Measure *</label>

                  <select
                    name="unit_of_measure"
                    value={formData.unit_of_measure}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">
                      Select unit
                    </option>
                    <option value="Piece">
                      Piece
                    </option>
                    <option value="Ream">
                      Ream
                    </option>
                    <option value="Box">
                      Box
                    </option>
                    <option value="Pack">
                      Pack
                    </option>
                    <option value="Unit">
                      Unit
                    </option>
                    <option value="Set">
                      Set
                    </option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Unit Price (KES) *</label>

                  <input
                    type="number"
                    name="unit_price"
                    value={formData.unit_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Reorder Level *</label>

                  <input
                    type="number"
                    name="reorder_level"
                    value={formData.reorder_level}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                    required
                  />
                </div>

                <div className="form-field form-field-full">
                  <label>Description</label>

                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Product description"
                    rows="3"
                  />
                </div>

                <div className="form-field form-field-full">
                  <label className="product-checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                    />

                    <span>
                      Product is active
                    </span>
                  </label>
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
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
