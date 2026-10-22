import API_BASE_URL from "../config/api";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";

import "./Receiving.css";



function Receiving() {
  const [receipts, setReceipts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showReceiveModal, setShowReceiveModal] =
    useState(false);

  const [showViewModal, setShowViewModal] =
    useState(false);

  const [selectedReceipt, setSelectedReceipt] =
    useState(null);

  const [selectedPoId, setSelectedPoId] =
    useState("");

  const [deliveryNoteNumber, setDeliveryNoteNumber] =
    useState("");

  const [invoiceNumber, setInvoiceNumber] =
    useState("");

  const [receiptRemarks, setReceiptRemarks] =
    useState("");

  const [receiptItems, setReceiptItems] =
    useState([]);


  // ======================================================
  // FETCH DATA
  // ======================================================

  const fetchReceipts = async () => {
    const response = await fetch(
      `${API_BASE_URL}/goods-receipts`
    );

    if (!response.ok) {
      throw new Error(
        "Unable to load goods receipts."
      );
    }

    return response.json();
  };


  const fetchPurchaseOrders = async () => {
    const response = await fetch(
      `${API_BASE_URL}/purchase-orders`
    );

    if (!response.ok) {
      throw new Error(
        "Unable to load purchase orders."
      );
    }

    return response.json();
  };


  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        receiptData,
        purchaseOrderData,
      ] = await Promise.all([
        fetchReceipts(),
        fetchPurchaseOrders(),
      ]);

      setReceipts(receiptData);
      setPurchaseOrders(purchaseOrderData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, []);


  // ======================================================
  // ELIGIBLE PURCHASE ORDERS
  // ======================================================

  const eligiblePurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(
      (order) =>
        order.status === "sent" ||
        order.status === "partially_received"
    );
  }, [purchaseOrders]);


  // ======================================================
  // RECEIPT METRICS
  // ======================================================

  const completedReceipts = useMemo(() => {
    return receipts.filter(
      (receipt) =>
        receipt.status === "completed"
    ).length;
  }, [receipts]);


  const totalAccepted = useMemo(() => {
    return receipts.reduce(
      (receiptTotal, receipt) => {
        const itemTotal =
          receipt.items?.reduce(
            (itemSum, item) =>
              itemSum +
              Number(
                item.accepted_quantity || 0
              ),
            0
          ) || 0;

        return receiptTotal + itemTotal;
      },
      0
    );
  }, [receipts]);


  const totalRejected = useMemo(() => {
    return receipts.reduce(
      (receiptTotal, receipt) => {
        const itemTotal =
          receipt.items?.reduce(
            (itemSum, item) =>
              itemSum +
              Number(
                item.rejected_quantity || 0
              ),
            0
          ) || 0;

        return receiptTotal + itemTotal;
      },
      0
    );
  }, [receipts]);


  // ======================================================
  // SEARCH
  // ======================================================

  const filteredReceipts = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    if (!search) {
      return receipts;
    }

    return receipts.filter((receipt) => {
      const searchableText = [
        receipt.receipt_number,
        receipt.po_number,
        receipt.receiver_name,
        receipt.delivery_note_number,
        receipt.invoice_number,
        receipt.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [receipts, searchTerm]);


  // ======================================================
  // OPEN RECEIVE MODAL
  // ======================================================

  const openReceiveModal = () => {
    setError("");
    setMessage("");

    setSelectedPoId("");
    setDeliveryNoteNumber("");
    setInvoiceNumber("");
    setReceiptRemarks("");
    setReceiptItems([]);

    setShowReceiveModal(true);
  };


  // ======================================================
  // SELECT PURCHASE ORDER
  // ======================================================

  const handlePurchaseOrderChange = (event) => {
    const poId = event.target.value;

    setSelectedPoId(poId);
    setError("");

    if (!poId) {
      setReceiptItems([]);
      return;
    }

    const purchaseOrder =
      eligiblePurchaseOrders.find(
        (order) =>
          String(order.id) === String(poId)
      );

    if (!purchaseOrder) {
      setReceiptItems([]);
      return;
    }

    const items = purchaseOrder.items
      .map((item) => {
        const outstandingQuantity =
          Number(item.quantity) -
          Number(item.quantity_received || 0);

        return {
          purchase_order_item_id: item.id,
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          ordered_quantity: Number(
            item.quantity
          ),
          already_received: Number(
            item.quantity_received || 0
          ),
          outstanding_quantity:
            outstandingQuantity,
          quantity_received:
            outstandingQuantity,
          accepted_quantity:
            outstandingQuantity,
          rejected_quantity: 0,
          remarks: "",
        };
      })
      .filter(
        (item) =>
          item.outstanding_quantity > 0
      );

    setReceiptItems(items);
  };


  // ======================================================
  // UPDATE RECEIPT ITEM
  // ======================================================

  const updateReceiptItem = (
    index,
    field,
    value
  ) => {
    setReceiptItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  };


  // ======================================================
  // VALIDATE RECEIPT
  // ======================================================

  const validateReceipt = () => {
    if (!selectedPoId) {
      return "Select a purchase order.";
    }

    if (receiptItems.length === 0) {
      return (
        "The selected purchase order has " +
        "no outstanding items to receive."
      );
    }

    for (const item of receiptItems) {
      const received = Number(
        item.quantity_received
      );

      const accepted = Number(
        item.accepted_quantity
      );

      const rejected = Number(
        item.rejected_quantity
      );

      if (
        !Number.isInteger(received) ||
        received <= 0
      ) {
        return (
          `${item.product_name}: received ` +
          "quantity must be greater than zero."
        );
      }

      if (
        received >
        item.outstanding_quantity
      ) {
        return (
          `${item.product_name}: received ` +
          "quantity cannot exceed the " +
          "outstanding quantity."
        );
      }

      if (
        !Number.isInteger(accepted) ||
        accepted < 0
      ) {
        return (
          `${item.product_name}: accepted ` +
          "quantity cannot be negative."
        );
      }

      if (
        !Number.isInteger(rejected) ||
        rejected < 0
      ) {
        return (
          `${item.product_name}: rejected ` +
          "quantity cannot be negative."
        );
      }

      if (
        accepted + rejected !== received
      ) {
        return (
          `${item.product_name}: accepted ` +
          "plus rejected quantity must " +
          "equal received quantity."
        );
      }
    }

    return null;
  };


  // ======================================================
  // SUBMIT GOODS RECEIPT
  // ======================================================

  const handleSubmitReceipt = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    const validationError =
      validateReceipt();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      purchase_order_id:
        Number(selectedPoId),

      delivery_note_number:
        deliveryNoteNumber.trim() || null,

      invoice_number:
        invoiceNumber.trim() || null,

      remarks:
        receiptRemarks.trim() || null,

      items: receiptItems.map((item) => ({
        purchase_order_item_id:
          item.purchase_order_item_id,

        quantity_received:
          Number(item.quantity_received),

        accepted_quantity:
          Number(item.accepted_quantity),

        rejected_quantity:
          Number(item.rejected_quantity),

        remarks:
          item.remarks.trim() || null,
      })),
    };

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE_URL}/goods-receipts`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.detail ||
            "Unable to record goods receipt."
        );
      }

      setShowReceiveModal(false);

      setMessage(
        `${responseData.receipt_number} ` +
          "recorded successfully."
      );

      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };


  // ======================================================
  // VIEW RECEIPT
  // ======================================================

  const openReceiptDetails = (receipt) => {
    setSelectedReceipt(receipt);
    setShowViewModal(true);
  };


  // ======================================================
  // HELPERS
  // ======================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    const parsedDate = new Date(
      `${dateValue}T00:00:00`
    );

    return parsedDate.toLocaleDateString(
      "en-KE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };


  const formatDateTime = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    return new Date(
      dateValue
    ).toLocaleString("en-KE");
  };


  const formatStatus = (statusValue) => {
    if (!statusValue) {
      return "Unknown";
    }

    return statusValue
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };


  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="page-content receiving-page">
      <div className="receiving-header">
        <div>
          <p className="eyebrow">
            PROCUREMENT & INVENTORY
          </p>

          <h2>Goods Receiving</h2>

          <p className="page-description">
            Record supplier deliveries,
            inspect received goods and
            automatically update inventory.
          </p>
        </div>

        <button
          className="receiving-primary-button"
          onClick={openReceiveModal}
          disabled={
            eligiblePurchaseOrders.length ===
            0
          }
        >
          <Plus size={18} />
          Receive Goods
        </button>
      </div>


      {message && (
        <div className="receiving-message success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}


      {error && (
        <div className="receiving-message error">
          <span>{error}</span>
        </div>
      )}


      <div className="receiving-stats">
        <div className="receiving-stat-card">
          <div className="receiving-stat-icon">
            <ClipboardCheck size={22} />
          </div>

          <div>
            <span>Total Receipts</span>
            <strong>{receipts.length}</strong>
          </div>
        </div>


        <div className="receiving-stat-card">
          <div className="receiving-stat-icon">
            <PackageCheck size={22} />
          </div>

          <div>
            <span>Completed</span>
            <strong>
              {completedReceipts}
            </strong>
          </div>
        </div>


        <div className="receiving-stat-card">
          <div className="receiving-stat-icon">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>Accepted Units</span>
            <strong>{totalAccepted}</strong>
          </div>
        </div>


        <div className="receiving-stat-card">
          <div className="receiving-stat-icon">
            <Truck size={22} />
          </div>

          <div>
            <span>Rejected Units</span>
            <strong>{totalRejected}</strong>
          </div>
        </div>
      </div>


      <div className="receiving-panel">
        <div className="receiving-panel-header">
          <div>
            <h3>Goods Receipt Register</h3>
            <p>
              Review completed supplier
              deliveries and inspection results.
            </p>
          </div>

          <div className="receiving-actions">
            <div className="receiving-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />
            </div>

            <button
              className="receiving-secondary-button"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "receiving-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>


        <div className="receiving-table-wrap">
          <table className="receiving-table">
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>Purchase Order</th>
                <th>Receipt Date</th>
                <th>Received By</th>
                <th>Delivery Note</th>
                <th>Invoice</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="receiving-empty"
                  >
                    Loading goods receipts...
                  </td>
                </tr>
              ) : filteredReceipts.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="receiving-empty"
                  >
                    No goods receipts found.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map(
                  (receipt) => (
                    <tr key={receipt.id}>
                      <td>
                        <strong>
                          {
                            receipt.receipt_number
                          }
                        </strong>
                      </td>

                      <td>
                        {receipt.po_number}
                      </td>

                      <td>
                        {formatDate(
                          receipt.receipt_date
                        )}
                      </td>

                      <td>
                        {
                          receipt.receiver_name
                        }
                      </td>

                      <td>
                        {receipt.delivery_note_number ||
                          "—"}
                      </td>

                      <td>
                        {receipt.invoice_number ||
                          "—"}
                      </td>

                      <td>
                        <span
                          className={
                            "receiving-status " +
                            `receiving-status-${receipt.status}`
                          }
                        >
                          {formatStatus(
                            receipt.status
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          className="receiving-view-button"
                          onClick={() =>
                            openReceiptDetails(
                              receipt
                            )
                          }
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ==================================================
          RECEIVE GOODS MODAL
      ================================================== */}

      {showReceiveModal && (
        <div className="receiving-modal-overlay">
          <div className="receiving-modal receiving-modal-large">
            <div className="receiving-modal-header">
              <div>
                <p className="eyebrow">
                  GOODS RECEIPT
                </p>

                <h3>Receive Goods</h3>
              </div>

              <button
                className="receiving-close-button"
                onClick={() =>
                  setShowReceiveModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>


            <form
              onSubmit={handleSubmitReceipt}
            >
              <div className="receiving-form-grid">
                <div className="receiving-field receiving-field-full">
                  <label>
                    Purchase Order
                  </label>

                  <select
                    value={selectedPoId}
                    onChange={
                      handlePurchaseOrderChange
                    }
                    required
                  >
                    <option value="">
                      Select purchase order
                    </option>

                    {eligiblePurchaseOrders.map(
                      (order) => (
                        <option
                          key={order.id}
                          value={order.id}
                        >
                          {order.po_number} —{" "}
                          {order.supplier_name}
                        </option>
                      )
                    )}
                  </select>

                  {eligiblePurchaseOrders.length ===
                    0 && (
                    <small>
                      There are currently no
                      sent or partially received
                      purchase orders.
                    </small>
                  )}
                </div>


                <div className="receiving-field">
                  <label>
                    Delivery Note Number
                  </label>

                  <input
                    type="text"
                    value={
                      deliveryNoteNumber
                    }
                    onChange={(event) =>
                      setDeliveryNoteNumber(
                        event.target.value
                      )
                    }
                    placeholder="e.g. DN-2026-002"
                  />
                </div>


                <div className="receiving-field">
                  <label>
                    Invoice Number
                  </label>

                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(event) =>
                      setInvoiceNumber(
                        event.target.value
                      )
                    }
                    placeholder="e.g. INV-2026-002"
                  />
                </div>


                <div className="receiving-field receiving-field-full">
                  <label>
                    General Remarks
                  </label>

                  <textarea
                    value={receiptRemarks}
                    onChange={(event) =>
                      setReceiptRemarks(
                        event.target.value
                      )
                    }
                    placeholder="Delivery and inspection remarks..."
                    rows="3"
                  />
                </div>
              </div>


              {selectedPoId &&
                receiptItems.length > 0 && (
                  <div className="receiving-items-section">
                    <div className="receiving-items-heading">
                      <h4>
                        Items to Receive
                      </h4>

                      <p>
                        Record the physical,
                        accepted and rejected
                        quantities.
                      </p>
                    </div>


                    <div className="receiving-table-wrap">
                      <table className="receiving-table receiving-items-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Ordered</th>
                            <th>
                              Previously Received
                            </th>
                            <th>Outstanding</th>
                            <th>Received Now</th>
                            <th>Accepted</th>
                            <th>Rejected</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>

                        <tbody>
                          {receiptItems.map(
                            (item, index) => (
                              <tr
                                key={
                                  item.purchase_order_item_id
                                }
                              >
                                <td>
                                  <strong>
                                    {
                                      item.product_name
                                    }
                                  </strong>

                                  <span className="receiving-product-code">
                                    {
                                      item.product_code
                                    }
                                  </span>
                                </td>

                                <td>
                                  {
                                    item.ordered_quantity
                                  }
                                </td>

                                <td>
                                  {
                                    item.already_received
                                  }
                                </td>

                                <td>
                                  <strong>
                                    {
                                      item.outstanding_quantity
                                    }
                                  </strong>
                                </td>

                                <td>
                                  <input
                                    className="receiving-qty-input"
                                    type="number"
                                    min="1"
                                    max={
                                      item.outstanding_quantity
                                    }
                                    value={
                                      item.quantity_received
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateReceiptItem(
                                        index,
                                        "quantity_received",
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <input
                                    className="receiving-qty-input"
                                    type="number"
                                    min="0"
                                    value={
                                      item.accepted_quantity
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateReceiptItem(
                                        index,
                                        "accepted_quantity",
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <input
                                    className="receiving-qty-input"
                                    type="number"
                                    min="0"
                                    value={
                                      item.rejected_quantity
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateReceiptItem(
                                        index,
                                        "rejected_quantity",
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <input
                                    type="text"
                                    value={
                                      item.remarks
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateReceiptItem(
                                        index,
                                        "remarks",
                                        event.target
                                          .value
                                      )
                                    }
                                    placeholder="Optional"
                                  />
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


              <div className="receiving-modal-actions">
                <button
                  type="button"
                  className="receiving-secondary-button"
                  onClick={() =>
                    setShowReceiveModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="receiving-primary-button"
                  disabled={
                    submitting ||
                    !selectedPoId ||
                    receiptItems.length === 0
                  }
                >
                  {submitting
                    ? "Recording..."
                    : "Complete Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ==================================================
          VIEW RECEIPT MODAL
      ================================================== */}

      {showViewModal &&
        selectedReceipt && (
          <div className="receiving-modal-overlay">
            <div className="receiving-modal receiving-modal-large">
              <div className="receiving-modal-header">
                <div>
                  <p className="eyebrow">
                    GOODS RECEIPT
                  </p>

                  <h3>
                    {
                      selectedReceipt.receipt_number
                    }
                  </h3>
                </div>

                <button
                  className="receiving-close-button"
                  onClick={() =>
                    setShowViewModal(false)
                  }
                >
                  <X size={20} />
                </button>
              </div>


              <div className="receiving-detail-grid">
                <div>
                  <span>
                    Purchase Order
                  </span>
                  <strong>
                    {selectedReceipt.po_number}
                  </strong>
                </div>

                <div>
                  <span>Receipt Date</span>
                  <strong>
                    {formatDate(
                      selectedReceipt.receipt_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Received By</span>
                  <strong>
                    {
                      selectedReceipt.receiver_name
                    }
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {formatStatus(
                      selectedReceipt.status
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Delivery Note
                  </span>
                  <strong>
                    {selectedReceipt.delivery_note_number ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Invoice</span>
                  <strong>
                    {selectedReceipt.invoice_number ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Recorded At</span>
                  <strong>
                    {formatDateTime(
                      selectedReceipt.created_at
                    )}
                  </strong>
                </div>

                <div>
                  <span>Remarks</span>
                  <strong>
                    {selectedReceipt.remarks ||
                      "—"}
                  </strong>
                </div>
              </div>


              <div className="receiving-items-section">
                <h4>Received Items</h4>

                <div className="receiving-table-wrap">
                  <table className="receiving-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Received</th>
                        <th>Accepted</th>
                        <th>Rejected</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedReceipt.items.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>
                                {
                                  item.product_name
                                }
                              </strong>

                              <span className="receiving-product-code">
                                {
                                  item.product_code
                                }
                              </span>
                            </td>

                            <td>
                              {
                                item.quantity_received
                              }
                            </td>

                            <td>
                              {
                                item.accepted_quantity
                              }
                            </td>

                            <td>
                              {
                                item.rejected_quantity
                              }
                            </td>

                            <td>
                              {item.remarks ||
                                "—"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


              <div className="receiving-modal-actions">
                <button
                  className="receiving-primary-button"
                  onClick={() =>
                    setShowViewModal(false)
                  }
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


export default Receiving;