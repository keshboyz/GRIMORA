import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Eye,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";

import "./PurchaseOrders.css";
import API_BASE_URL from "../config/api";


const ORDERS_API =
  `${API_BASE_URL}/purchase-orders`;

const REQUESTS_API =
  `${API_BASE_URL}/purchase-requests`;

const SUPPLIERS_API =
  `${API_BASE_URL}/suppliers`;


const emptyForm = {
  purchase_request_id: "",
  supplier_id: "",
  expected_delivery_date: "",
  delivery_address: "GRIMORA Main Stores, Nairobi",
  payment_terms: "30 days after delivery",
  tax_amount: "0",
  notes: "",
};


function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [showDetailsModal, setShowDetailsModal] =
    useState(false);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [form, setForm] = useState({
    ...emptyForm,
  });

  const [orderItems, setOrderItems] = useState([]);


  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadOrders = async () => {
    const response = await fetch(ORDERS_API);

    if (!response.ok) {
      throw new Error(
        "Unable to retrieve purchase orders."
      );
    }

    const data = await response.json();

    setOrders(data);

    return data;
  };


  const loadRequests = async () => {
    const response = await fetch(REQUESTS_API);

    if (!response.ok) {
      throw new Error(
        "Unable to retrieve purchase requests."
      );
    }

    const data = await response.json();

    setRequests(data);

    return data;
  };


  const loadSuppliers = async () => {
    const response = await fetch(SUPPLIERS_API);

    if (!response.ok) {
      throw new Error(
        "Unable to retrieve suppliers."
      );
    }

    const data = await response.json();

    setSuppliers(data);

    return data;
  };


  const loadPageData = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadOrders(),
        loadRequests(),
        loadSuppliers(),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the GRIMORA API."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadPageData();
  }, []);


  // =====================================================
  // FORMATTERS
  // =====================================================

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));


  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
    }).format(new Date(`${value}T00:00:00`));
  };


  const formatDateTime = (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };


  const formatStatus = (value) => {
    if (!value) {
      return "Unknown";
    }

    return value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };


  // =====================================================
  // APPROVED REQUESTS WITHOUT PURCHASE ORDERS
  // =====================================================

  const availableRequests = useMemo(() => {
    const linkedRequestIds = new Set(
      orders
        .filter(
          (order) =>
            order.purchase_request_id !== null &&
            order.purchase_request_id !== undefined
        )
        .map((order) =>
          Number(order.purchase_request_id)
        )
    );

    return requests.filter(
      (request) =>
        request.status === "approved" &&
        !linkedRequestIds.has(Number(request.id))
    );
  }, [orders, requests]);


  const activeSuppliers = useMemo(() => {
    return suppliers.filter(
      (supplier) =>
        supplier.status === "active"
    );
  }, [suppliers]);


  // =====================================================
  // CREATE PURCHASE ORDER
  // =====================================================

  const openCreateModal = () => {
    setForm({
      ...emptyForm,
    });

    setOrderItems([]);
    setFormError("");
    setSuccessMessage("");
    setShowCreateModal(true);
  };


  const closeCreateModal = () => {
    if (saving) {
      return;
    }

    setShowCreateModal(false);
    setFormError("");
    setOrderItems([]);
  };


  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };


  const handleRequestChange = (event) => {
    const requestId = event.target.value;

    setForm((previous) => ({
      ...previous,
      purchase_request_id: requestId,
    }));

    setFormError("");

    if (!requestId) {
      setOrderItems([]);
      return;
    }

    const selectedRequest =
      availableRequests.find(
        (request) =>
          Number(request.id) ===
          Number(requestId)
      );

    if (!selectedRequest) {
      setOrderItems([]);
      return;
    }

    const mappedItems =
      selectedRequest.items.map((item) => ({
        product_id: Number(item.product_id),
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(
          item.estimated_unit_price || 0
        ),
      }));

    setOrderItems(mappedItems);
  };


  const handleItemPriceChange = (
    index,
    value
  ) => {
    setOrderItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          unit_price: value,
        };
      })
    );
  };


  const subtotal = useMemo(() => {
    return orderItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0) *
          Number(item.unit_price || 0),
      0
    );
  }, [orderItems]);


  const taxAmount = Number(
    form.tax_amount || 0
  );

  const orderTotal = subtotal + taxAmount;


  const submitPurchaseOrder = async (
    event
  ) => {
    event.preventDefault();

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    if (!form.purchase_request_id) {
      setFormError(
        "Please select an approved purchase request."
      );
      setSaving(false);
      return;
    }

    if (!form.supplier_id) {
      setFormError(
        "Please select a supplier."
      );
      setSaving(false);
      return;
    }

    if (orderItems.length === 0) {
      setFormError(
        "The selected request has no items."
      );
      setSaving(false);
      return;
    }

    const invalidItem = orderItems.some(
      (item) =>
        Number(item.quantity) <= 0 ||
        Number(item.unit_price) < 0
    );

    if (invalidItem) {
      setFormError(
        "Please provide valid quantities and unit prices."
      );
      setSaving(false);
      return;
    }

    if (taxAmount < 0) {
      setFormError(
        "Tax amount cannot be negative."
      );
      setSaving(false);
      return;
    }

    const payload = {
      supplier_id: Number(
        form.supplier_id
      ),

      purchase_request_id: Number(
        form.purchase_request_id
      ),

      expected_delivery_date:
        form.expected_delivery_date || null,

      delivery_address:
        form.delivery_address.trim() || null,

      payment_terms:
        form.payment_terms.trim() || null,

      notes:
        form.notes.trim() || null,

      tax_amount: taxAmount,

      items: orderItems.map((item) => ({
        product_id: Number(
          item.product_id
        ),

        quantity: Number(
          item.quantity
        ),

        unit_price: Number(
          item.unit_price
        ),
      })),
    };

    try {
      const response = await fetch(
        ORDERS_API,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to create purchase order."
        );
      }

      setShowCreateModal(false);
      setOrderItems([]);

      setSuccessMessage(
        `${data.po_number} created successfully.`
      );

      await loadPageData();

      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (err) {
      setFormError(
        err.message ||
          "Unable to create purchase order."
      );
    } finally {
      setSaving(false);
    }
  };


  // =====================================================
  // VIEW ORDER
  // =====================================================

  const openDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };


  const closeDetails = () => {
    setShowDetailsModal(false);
    setSelectedOrder(null);
  };


  // =====================================================
  // FILTERS
  // =====================================================

  const filteredOrders = orders.filter(
    (order) => {
      const search =
        searchTerm.toLowerCase();

      return (
        (order.po_number || "")
          .toLowerCase()
          .includes(search) ||

        (order.supplier_name || "")
          .toLowerCase()
          .includes(search) ||

        (order.request_number || "")
          .toLowerCase()
          .includes(search) ||

        (order.status || "")
          .toLowerCase()
          .includes(search)
      );
    }
  );


  // =====================================================
  // METRICS
  // =====================================================

  const sentOrders = orders.filter(
    (order) =>
      order.status === "sent"
  ).length;


  const outstandingOrders =
    orders.filter(
      (order) =>
        ![
          "received",
          "cancelled",
        ].includes(order.status)
    ).length;


  const totalProcurementValue =
    orders.reduce(
      (total, order) =>
        total +
        Number(order.total_amount || 0),
      0
    );


  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            PROCUREMENT
          </p>

          <h2>Purchase Orders</h2>

          <p className="page-description">
            Track supplier purchase orders,
            delivery commitments and order
            values.
          </p>
        </div>

        <div className="po-header-actions">
          <button
            className="po-refresh-main"
            onClick={loadPageData}
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            className="po-create-main"
            onClick={openCreateModal}
            disabled={
              availableRequests.length === 0
            }
          >
            <Plus size={15} />
            Create Purchase Order
          </button>
        </div>
      </div>


      {successMessage && (
        <div className="po-success-message">
          {successMessage}
        </div>
      )}


      {availableRequests.length === 0 &&
        !loading && (
          <div className="po-info-message">
            There are currently no approved
            purchase requests waiting for a
            purchase order.
          </div>
        )}


      <div className="po-summary-grid">
        <div className="po-summary-card">
          <div>
            <span>
              Total Purchase Orders
            </span>

            <strong>{orders.length}</strong>
          </div>

          <ShoppingCart size={18} />
        </div>


        <div className="po-summary-card">
          <div>
            <span>Sent Orders</span>

            <strong>{sentOrders}</strong>
          </div>

          <FileText size={18} />
        </div>


        <div className="po-summary-card">
          <div>
            <span>Outstanding Orders</span>

            <strong>
              {outstandingOrders}
            </strong>
          </div>

          <Truck size={18} />
        </div>


        <div className="po-summary-card">
          <div>
            <span>Procurement Value</span>

            <strong>
              {formatCurrency(
                totalProcurementValue
              )}
            </strong>
          </div>

          <Package size={18} />
        </div>
      </div>


      <div className="po-panel">
        <div className="po-toolbar">
          <div>
            <h3>
              Purchase Order Register
            </h3>

            <p>
              {orders.length} purchase order
              {orders.length === 1
                ? ""
                : "s"}{" "}
              recorded
            </p>
          </div>


          <div className="po-toolbar-actions">
            <div className="po-search">
              <Search size={15} />

              <input
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search purchase orders..."
              />
            </div>

            <button
              className="po-icon-button"
              onClick={loadPageData}
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>


        {loading && (
          <div className="po-state">
            Loading purchase orders...
          </div>
        )}


        {!loading && error && (
          <div className="po-state po-error">
            {error}
          </div>
        )}


        {!loading &&
          !error &&
          filteredOrders.length === 0 && (
            <div className="po-state">
              No purchase orders found.
            </div>
          )}


        {!loading &&
          !error &&
          filteredOrders.length > 0 && (
            <div className="po-table-wrapper">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>
                      Purchase Request
                    </th>
                    <th>Order Date</th>
                    <th>
                      Expected Delivery
                    </th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>
                            {
                              order.po_number
                            }
                          </strong>
                        </td>

                        <td>
                          <div className="po-supplier">
                            <Building2
                              size={13}
                            />

                            {
                              order.supplier_name
                            }
                          </div>
                        </td>

                        <td>
                          {order.request_number ||
                            "—"}
                        </td>

                        <td>
                          {formatDate(
                            order.order_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            order.expected_delivery_date
                          )}
                        </td>

                        <td>
                          {order.items?.length ||
                            0}
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              order.total_amount
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              `po-status po-status-${order.status}`
                            }
                          >
                            {formatStatus(
                              order.status
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            className="po-view-button"
                            onClick={() =>
                              openDetails(
                                order
                              )
                            }
                          >
                            <Eye size={13} />
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>


      {/* ===============================================
          CREATE PURCHASE ORDER MODAL
      =============================================== */}

      {showCreateModal && (
        <div
          className="po-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="po-modal po-create-modal">
            <div className="po-modal-header">
              <div>
                <p className="eyebrow">
                  NEW PURCHASE ORDER
                </p>

                <h3>
                  Create Purchase Order
                </h3>

                <span>
                  Convert an approved purchase
                  request into a supplier order.
                </span>
              </div>

              <button
                className="po-close-button"
                onClick={closeCreateModal}
                type="button"
              >
                <X size={17} />
              </button>
            </div>


            <form
              onSubmit={submitPurchaseOrder}
            >
              <div className="po-create-content">
                {formError && (
                  <div className="po-form-error">
                    {formError}
                  </div>
                )}


                <div className="po-form-grid">
                  <div className="po-field">
                    <label>
                      Approved Purchase Request *
                    </label>

                    <select
                      value={
                        form.purchase_request_id
                      }
                      onChange={
                        handleRequestChange
                      }
                      required
                    >
                      <option value="">
                        Select approved request
                      </option>

                      {availableRequests.map(
                        (request) => (
                          <option
                            key={request.id}
                            value={request.id}
                          >
                            {
                              request.request_number
                            }{" "}
                            —{" "}
                            {request.department ||
                              "No department"}
                          </option>
                        )
                      )}
                    </select>
                  </div>


                  <div className="po-field">
                    <label>
                      Supplier *
                    </label>

                    <select
                      name="supplier_id"
                      value={
                        form.supplier_id
                      }
                      onChange={
                        handleFormChange
                      }
                      required
                    >
                      <option value="">
                        Select supplier
                      </option>

                      {activeSuppliers.map(
                        (supplier) => (
                          <option
                            key={supplier.id}
                            value={supplier.id}
                          >
                            {
                              supplier.supplier_code
                            }{" "}
                            —{" "}
                            {
                              supplier.supplier_name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>


                  <div className="po-field">
                    <label>
                      Expected Delivery
                    </label>

                    <input
                      type="date"
                      name="expected_delivery_date"
                      value={
                        form.expected_delivery_date
                      }
                      onChange={
                        handleFormChange
                      }
                    />
                  </div>


                  <div className="po-field">
                    <label>
                      Payment Terms
                    </label>

                    <input
                      name="payment_terms"
                      value={
                        form.payment_terms
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="e.g. 30 days after delivery"
                    />
                  </div>


                  <div className="po-field po-field-full">
                    <label>
                      Delivery Address
                    </label>

                    <input
                      name="delivery_address"
                      value={
                        form.delivery_address
                      }
                      onChange={
                        handleFormChange
                      }
                    />
                  </div>


                  <div className="po-field">
                    <label>
                      Tax Amount (KES)
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="tax_amount"
                      value={
                        form.tax_amount
                      }
                      onChange={
                        handleFormChange
                      }
                    />
                  </div>


                  <div className="po-field">
                    <label>Notes</label>

                    <input
                      name="notes"
                      value={form.notes}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Optional order notes"
                    />
                  </div>
                </div>


                <div className="po-create-items-heading">
                  <div>
                    <h4>Order Items</h4>

                    <p>
                      Items are loaded from the
                      approved purchase request.
                    </p>
                  </div>
                </div>


                {orderItems.length === 0 ? (
                  <div className="po-create-empty">
                    Select an approved purchase
                    request to load its items.
                  </div>
                ) : (
                  <div className="po-items-wrapper">
                    <table className="po-items-table po-create-items-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>
                            Unit Price
                          </th>
                          <th>
                            Line Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {orderItems.map(
                          (item, index) => (
                            <tr
                              key={
                                item.product_id
                              }
                            >
                              <td>
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
                              </td>

                              <td>
                                {
                                  item.quantity
                                }
                              </td>

                              <td>
                                <input
                                  className="po-price-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    item.unit_price
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleItemPriceChange(
                                      index,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  required
                                />
                              </td>

                              <td>
                                <strong>
                                  {formatCurrency(
                                    Number(
                                      item.quantity
                                    ) *
                                      Number(
                                        item.unit_price ||
                                          0
                                      )
                                  )}
                                </strong>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}


                <div className="po-create-totals">
                  <div>
                    <span>Subtotal</span>

                    <strong>
                      {formatCurrency(
                        subtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Tax</span>

                    <strong>
                      {formatCurrency(
                        taxAmount
                      )}
                    </strong>
                  </div>

                  <div className="po-create-grand-total">
                    <span>
                      Purchase Order Total
                    </span>

                    <strong>
                      {formatCurrency(
                        orderTotal
                      )}
                    </strong>
                  </div>
                </div>
              </div>


              <div className="po-create-actions">
                <button
                  type="button"
                  className="po-close-main"
                  onClick={
                    closeCreateModal
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="po-create-main"
                  disabled={
                    saving ||
                    !form.purchase_request_id ||
                    !form.supplier_id ||
                    orderItems.length === 0
                  }
                >
                  <ShoppingCart size={14} />

                  {saving
                    ? "Creating..."
                    : "Create Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ===============================================
          PURCHASE ORDER DETAILS MODAL
      =============================================== */}

      {showDetailsModal &&
        selectedOrder && (
          <div className="po-modal-overlay">
            <div className="po-modal">
              <div className="po-modal-header">
                <div>
                  <p className="eyebrow">
                    PURCHASE ORDER
                  </p>

                  <h3>
                    {
                      selectedOrder.po_number
                    }
                  </h3>

                  <span>
                    Supplier order and delivery
                    information.
                  </span>
                </div>

                <button
                  className="po-close-button"
                  onClick={closeDetails}
                >
                  <X size={17} />
                </button>
              </div>


              <div className="po-modal-content">
                <div className="po-order-banner">
                  <div>
                    <span>Status</span>

                    <strong>
                      {formatStatus(
                        selectedOrder.status
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Total Value</span>

                    <strong>
                      {formatCurrency(
                        selectedOrder.total_amount
                      )}
                    </strong>
                  </div>
                </div>


                <div className="po-details-grid">
                  <div>
                    <span>Supplier</span>

                    <strong>
                      {
                        selectedOrder.supplier_name
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Purchase Request
                    </span>

                    <strong>
                      {selectedOrder.request_number ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Created By</span>

                    <strong>
                      {
                        selectedOrder.creator_name
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Order Date</span>

                    <strong>
                      {formatDate(
                        selectedOrder.order_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Expected Delivery
                    </span>

                    <strong>
                      {formatDate(
                        selectedOrder.expected_delivery_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Created At</span>

                    <strong>
                      {formatDateTime(
                        selectedOrder.created_at
                      )}
                    </strong>
                  </div>
                </div>


                <div className="po-section">
                  <div className="po-section-title">
                    <Truck size={14} />
                    <span>
                      Delivery Information
                    </span>
                  </div>

                  <div className="po-information-box">
                    <div>
                      <span>
                        Delivery Address
                      </span>

                      <strong>
                        {selectedOrder.delivery_address ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payment Terms
                      </span>

                      <strong>
                        {selectedOrder.payment_terms ||
                          "—"}
                      </strong>
                    </div>
                  </div>
                </div>


                <div className="po-section">
                  <div className="po-section-title">
                    <FileText size={14} />

                    <span>Notes</span>
                  </div>

                  <div className="po-information-box">
                    <div>
                      <strong>
                        {selectedOrder.notes ||
                          "No notes recorded."}
                      </strong>
                    </div>
                  </div>
                </div>


                <div className="po-section">
                  <div className="po-section-title">
                    <Package size={14} />

                    <span>Ordered Items</span>
                  </div>

                  <div className="po-items-wrapper">
                    <table className="po-items-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>
                            Unit Price
                          </th>
                          <th>
                            Received
                          </th>
                          <th>Total</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedOrder.items?.map(
                          (item) => (
                            <tr key={item.id}>
                              <td>
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
                              </td>

                              <td>
                                {item.quantity}
                              </td>

                              <td>
                                {formatCurrency(
                                  item.unit_price
                                )}
                              </td>

                              <td>
                                {
                                  item.quantity_received
                                }
                              </td>

                              <td>
                                {formatCurrency(
                                  item.line_total
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>


                <div className="po-totals">
                  <div>
                    <span>Subtotal</span>

                    <strong>
                      {formatCurrency(
                        selectedOrder.subtotal
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Tax</span>

                    <strong>
                      {formatCurrency(
                        selectedOrder.tax_amount
                      )}
                    </strong>
                  </div>

                  <div className="po-grand-total">
                    <span>Total</span>

                    <strong>
                      {formatCurrency(
                        selectedOrder.total_amount
                      )}
                    </strong>
                  </div>
                </div>
              </div>


              <div className="po-modal-footer">
                <div className="po-delivery-note">
                  <CalendarDays size={13} />

                  Expected delivery:{" "}
                  {formatDate(
                    selectedOrder.expected_delivery_date
                  )}
                </div>

                <button
                  className="po-close-main"
                  onClick={closeDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}


export default PurchaseOrders;