
import { useEffect, useState } from "react";
import "./Inventory.css";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleX,
  History,
  PackageCheck,
  RefreshCw,
  Search,
  Warehouse,
  X,
} from "lucide-react";

import API_BASE_URL from "../config/api";

const INVENTORY_API = `${API_BASE_URL}/inventory`;
const MOVEMENTS_API = `${API_BASE_URL}/stock-movements`;

const initialTransaction = {
  product_id: "",
  movement_type: "receipt",
  quantity: "",
  reference_type: "",
  reference_id: "",
  remarks: "",
};

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTransactionModal, setShowTransactionModal] =
    useState(false);

  const [transaction, setTransaction] =
    useState(initialTransaction);

  const [saving, setSaving] = useState(false);
  const [transactionError, setTransactionError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadInventory = async () => {
    const response = await fetch(INVENTORY_API);

    if (!response.ok) {
      throw new Error("Unable to retrieve inventory.");
    }

    const data = await response.json();
    setInventory(data);
  };

  const loadMovements = async () => {
    const response = await fetch(MOVEMENTS_API);

    if (!response.ok) {
      throw new Error(
        "Unable to retrieve stock movements."
      );
    }

    const data = await response.json();
    setMovements(data);
  };

  const loadPageData = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadInventory(),
        loadMovements(),
      ]);
    } catch {
      setError(
        "Could not connect to the GRIMORA API. Make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const openTransactionModal = (type) => {
    setTransaction({
      ...initialTransaction,
      movement_type: type,
    });

    setTransactionError("");
    setShowTransactionModal(true);
  };

  const closeTransactionModal = () => {
    if (saving) {
      return;
    }

    setShowTransactionModal(false);
    setTransactionError("");
  };

  const handleTransactionChange = (event) => {
    const { name, value } = event.target;

    setTransaction((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const submitTransaction = async (event) => {
    event.preventDefault();

    setSaving(true);
    setTransactionError("");
    setSuccessMessage("");

    const payload = {
      product_id: Number(transaction.product_id),
      movement_type: transaction.movement_type,
      quantity: Number(transaction.quantity),

      reference_type:
        transaction.reference_type || null,

      reference_id:
        transaction.reference_id
          ? Number(transaction.reference_id)
          : null,

      performed_by: 1,

      remarks:
        transaction.remarks || null,
    };

    try {
      const response = await fetch(MOVEMENTS_API, {
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

        throw new Error(
          "Unable to process stock transaction."
        );
      }

      const selectedProduct = inventory.find(
        (item) =>
          item.product_id ===
          Number(transaction.product_id)
      );

      const action =
        transaction.movement_type === "receipt"
          ? "received"
          : "issued";

      setSuccessMessage(
        `${transaction.quantity} ${
          selectedProduct?.unit_of_measure || "unit(s)"
        } of ${
          selectedProduct?.product_name || "product"
        } ${action} successfully.`
      );

      setShowTransactionModal(false);
      setTransaction(initialTransaction);

      await loadPageData();

      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (err) {
      setTransactionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredInventory = inventory.filter(
    (item) => {
      const search = searchTerm.toLowerCase();

      return (
        item.product_name
          .toLowerCase()
          .includes(search) ||
        item.product_code
          .toLowerCase()
          .includes(search) ||
        (item.category || "")
          .toLowerCase()
          .includes(search) ||
        (item.storage_location || "")
          .toLowerCase()
          .includes(search) ||
        item.stock_status
          .toLowerCase()
          .includes(search)
      );
    }
  );

  const totalUnits = inventory.reduce(
    (total, item) =>
      total + item.quantity_on_hand,
    0
  );

  const lowStockItems = inventory.filter(
    (item) =>
      item.stock_status === "Low Stock"
  ).length;

  const outOfStockItems = inventory.filter(
    (item) =>
      item.stock_status === "Out of Stock"
  ).length;

  const totalStockValue = inventory.reduce(
    (total, item) =>
      total + Number(item.stock_value),
    0
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (date) =>
    new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));

  const getStatusClass = (status) => {
    if (status === "In Stock") {
      return "inventory-in-stock";
    }

    if (status === "Low Stock") {
      return "inventory-low-stock";
    }

    return "inventory-out-stock";
  };

  const getProductName = (productId) => {
    const item = inventory.find(
      (inventoryItem) =>
        inventoryItem.product_id === productId
    );

    return item
      ? item.product_name
      : `Product #${productId}`;
  };

  const getMovementSign = (type) => {
    const incoming = [
      "receipt",
      "adjustment_in",
      "return_in",
    ];

    return incoming.includes(type) ? "+" : "-";
  };

  return (
    <div className="page-content inventory-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            INVENTORY CONTROL
          </p>

          <h2>Inventory</h2>

          <p className="page-description">
            Monitor stock levels, process stock
            transactions and review movement history.
          </p>
        </div>

        <div className="inventory-header-actions">
          <button
            className="secondary-button"
            onClick={() =>
              openTransactionModal("issue")
            }
          >
            <ArrowUpFromLine size={16} />
            Issue Stock
          </button>

          <button
            className="primary-button"
            onClick={() =>
              openTransactionModal("receipt")
            }
          >
            <ArrowDownToLine size={16} />
            Receive Stock
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="inventory-success">
          {successMessage}
        </div>
      )}

      <div className="inventory-summary-grid">
        <div className="inventory-summary-card">
          <div>
            <span>Total Units in Stock</span>
            <strong>{totalUnits}</strong>
          </div>

          <div className="inventory-summary-icon">
            <Boxes size={20} />
          </div>
        </div>

        <div className="inventory-summary-card">
          <div>
            <span>Low Stock Items</span>
            <strong>{lowStockItems}</strong>
          </div>

          <div className="inventory-summary-icon">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="inventory-summary-card">
          <div>
            <span>Out of Stock</span>
            <strong>{outOfStockItems}</strong>
          </div>

          <div className="inventory-summary-icon">
            <CircleX size={20} />
          </div>
        </div>

        <div className="inventory-summary-card">
          <div>
            <span>Total Stock Value</span>

            <strong>
              {formatCurrency(totalStockValue)}
            </strong>
          </div>

          <div className="inventory-summary-icon">
            <PackageCheck size={20} />
          </div>
        </div>
      </div>

      <div className="inventory-panel">
        <div className="inventory-toolbar">
          <div>
            <h3>Stock Overview</h3>

            <p>
              {inventory.length} inventory{" "}
              {inventory.length === 1
                ? "item"
                : "items"}
            </p>
          </div>

          <div className="inventory-toolbar-actions">
            <div className="inventory-search">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <button
              className="refresh-button"
              onClick={loadPageData}
              title="Refresh inventory"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="inventory-state">
            Loading inventory...
          </div>
        )}

        {!loading && error && (
          <div className="inventory-state inventory-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredInventory.length > 0 && (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Location</th>
                    <th>On Hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Reorder</th>
                    <th>Stock Value</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInventory.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="inventory-product-cell">
                            <div className="inventory-product-icon">
                              <Warehouse
                                size={15}
                              />
                            </div>

                            <div>
                              <strong>
                                {
                                  item.product_name
                                }
                              </strong>

                              <span>
                                {
                                  item.product_code
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {item.storage_location ||
                            "—"}
                        </td>

                        <td className="inventory-quantity">
                          {item.quantity_on_hand}
                        </td>

                        <td>
                          {item.quantity_reserved}
                        </td>

                        <td>
                          {
                            item.available_quantity
                          }
                        </td>

                        <td>
                          {item.reorder_level}
                        </td>

                        <td className="inventory-value">
                          {formatCurrency(
                            Number(
                              item.stock_value
                            )
                          )}
                        </td>

                        <td>
                          <span
                            className={`inventory-status ${getStatusClass(
                              item.stock_status
                            )}`}
                          >
                            {item.stock_status}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="movement-panel">
        <div className="movement-panel-header">
          <div>
            <div className="movement-title">
              <History size={16} />
              <h3>Stock Movement History</h3>
            </div>

            <p>
              Latest inventory receipts, issues and
              adjustments.
            </p>
          </div>

          <span>
            {movements.length} transaction
            {movements.length === 1 ? "" : "s"}
          </span>
        </div>

        {movements.length === 0 ? (
          <div className="inventory-state">
            No stock movements recorded.
          </div>
        ) : (
          <div className="movement-table-wrapper">
            <table className="movement-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      {formatDate(
                        movement.movement_date
                      )}
                    </td>

                    <td>
                      {getProductName(
                        movement.product_id
                      )}
                    </td>

                    <td>
                      <span className="movement-type">
                        {movement.movement_type
                          .replaceAll("_", " ")
                          .toUpperCase()}
                      </span>
                    </td>

                    <td
                      className={
                        getMovementSign(
                          movement.movement_type
                        ) === "+"
                          ? "movement-positive"
                          : "movement-negative"
                      }
                    >
                      {getMovementSign(
                        movement.movement_type
                      )}
                      {movement.quantity}
                    </td>

                    <td>
                      {movement.reference_type
                        ? `${movement.reference_type}${
                            movement.reference_id
                              ? ` #${movement.reference_id}`
                              : ""
                          }`
                        : "—"}
                    </td>

                    <td>
                      {movement.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTransactionModal && (
        <div
          className="inventory-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeTransactionModal();
            }
          }}
        >
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <div>
                <p className="eyebrow">
                  STOCK TRANSACTION
                </p>

                <h3>
                  {transaction.movement_type ===
                  "receipt"
                    ? "Receive Stock"
                    : "Issue Stock"}
                </h3>

                <span>
                  {transaction.movement_type ===
                  "receipt"
                    ? "Record stock entering the GRIMORA inventory."
                    : "Record stock leaving the GRIMORA inventory."}
                </span>
              </div>

              <button
                type="button"
                className="inventory-modal-close"
                onClick={
                  closeTransactionModal
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="inventory-transaction-form"
              onSubmit={submitTransaction}
            >
              {transactionError && (
                <div className="inventory-form-error">
                  {transactionError}
                </div>
              )}

              <div className="inventory-form-grid">
                <div className="inventory-form-field inventory-field-full">
                  <label>Product *</label>

                  <select
                    name="product_id"
                    value={
                      transaction.product_id
                    }
                    onChange={
                      handleTransactionChange
                    }
                    required
                  >
                    <option value="">
                      Select product
                    </option>

                    {inventory.map((item) => (
                      <option
                        key={item.product_id}
                        value={item.product_id}
                      >
                        {item.product_code} —{" "}
                        {item.product_name} (
                        {item.quantity_on_hand}{" "}
                        available)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventory-form-field">
                  <label>Quantity *</label>

                  <input
                    type="number"
                    name="quantity"
                    value={
                      transaction.quantity
                    }
                    onChange={
                      handleTransactionChange
                    }
                    min="1"
                    step="1"
                    placeholder="Enter quantity"
                    required
                  />
                </div>

                <div className="inventory-form-field">
                  <label>
                    Reference Type
                  </label>

                  <input
                    name="reference_type"
                    value={
                      transaction.reference_type
                    }
                    onChange={
                      handleTransactionChange
                    }
                    placeholder="e.g. department_issue"
                  />
                </div>

                <div className="inventory-form-field">
                  <label>
                    Reference ID
                  </label>

                  <input
                    type="number"
                    name="reference_id"
                    value={
                      transaction.reference_id
                    }
                    onChange={
                      handleTransactionChange
                    }
                    min="1"
                    placeholder="Optional"
                  />
                </div>

                <div className="inventory-form-field">
                  <label>
                    Performed By
                  </label>

                  <input
                    value="GRIMORA Administrator"
                    disabled
                  />
                </div>

                <div className="inventory-form-field inventory-field-full">
                  <label>Remarks</label>

                  <textarea
                    name="remarks"
                    value={
                      transaction.remarks
                    }
                    onChange={
                      handleTransactionChange
                    }
                    rows="3"
                    placeholder="Add transaction notes..."
                  />
                </div>
              </div>

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeTransactionModal
                  }
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
                    ? "Processing..."
                    : transaction.movement_type ===
                      "receipt"
                    ? "Receive Stock"
                    : "Issue Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
