import API_BASE_URL from "../config/api";
import { useEffect, useMemo, useState } from "react";

import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Download,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./Reports.css";


const ORDERS_API =
  `${API_BASE_URL}/purchase-orders`;

const INVENTORY_API =
  `${API_BASE_URL}/inventory`;

const SUPPLIERS_API =
  `${API_BASE_URL}/suppliers`;

const RECEIPTS_API =
  `${API_BASE_URL}/goods-receipts`;


function Reports() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");

      const responses = await Promise.all([
        fetch(ORDERS_API),
        fetch(INVENTORY_API),
        fetch(SUPPLIERS_API),
        fetch(RECEIPTS_API),
      ]);

      const failed = responses.find(
        (response) => !response.ok
      );

      if (failed) {
        throw new Error(
          "Unable to retrieve reporting data."
        );
      }

      const [
        orderData,
        inventoryData,
        supplierData,
        receiptData,
      ] = await Promise.all(
        responses.map((response) =>
          response.json()
        )
      );

      setOrders(orderData);
      setInventory(inventoryData);
      setSuppliers(supplierData);
      setReceipts(receiptData);
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
    loadReports();
  }, []);


  // =====================================================
  // FORMATTERS
  // =====================================================

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));


  const formatNumber = (value) =>
    new Intl.NumberFormat("en-KE").format(
      Number(value || 0)
    );


  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
    }).format(
      new Date(`${value}T00:00:00`)
    );
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
  // SUMMARY METRICS
  // =====================================================

  const procurementValue = orders.reduce(
    (total, order) =>
      total +
      Number(order.total_amount || 0),
    0
  );


  const inventoryValue = inventory.reduce(
    (total, item) =>
      total +
      Number(item.stock_value || 0),
    0
  );


  const activeSuppliers = suppliers.filter(
    (supplier) =>
      supplier.status === "active"
  ).length;


  const completedReceipts = receipts.filter(
    (receipt) =>
      receipt.status === "completed"
  ).length;


  const receivedOrders = orders.filter(
    (order) =>
      order.status === "received"
  ).length;


  const openOrders = orders.filter(
    (order) =>
      ![
        "received",
        "cancelled",
      ].includes(order.status)
  ).length;


  const acceptedUnits = receipts.reduce(
    (receiptTotal, receipt) =>
      receiptTotal +
      (receipt.items || []).reduce(
        (itemTotal, item) =>
          itemTotal +
          Number(
            item.accepted_quantity || 0
          ),
        0
      ),
    0
  );


  const rejectedUnits = receipts.reduce(
    (receiptTotal, receipt) =>
      receiptTotal +
      (receipt.items || []).reduce(
        (itemTotal, item) =>
          itemTotal +
          Number(
            item.rejected_quantity || 0
          ),
        0
      ),
    0
  );


  // =====================================================
  // SUPPLIER SPEND
  // =====================================================

  const supplierSpend = useMemo(() => {
    const totals = {};

    orders.forEach((order) => {
      const supplierName =
        order.supplier_name ||
        "Unknown Supplier";

      if (!totals[supplierName]) {
        totals[supplierName] = {
          supplier: supplierName,
          orders: 0,
          value: 0,
        };
      }

      totals[supplierName].orders += 1;

      totals[supplierName].value += Number(
        order.total_amount || 0
      );
    });

    return Object.values(totals).sort(
      (a, b) => b.value - a.value
    );
  }, [orders]);


  // =====================================================
  // ORDER STATUS DATA
  // =====================================================

  const orderStatusData = useMemo(() => {
    const statusTotals = {};

    orders.forEach((order) => {
      const status =
        formatStatus(order.status);

      statusTotals[status] =
        (statusTotals[status] || 0) + 1;
    });

    return Object.entries(statusTotals).map(
      ([name, value]) => ({
        name,
        value,
      })
    );
  }, [orders]);


  // =====================================================
  // INVENTORY CATEGORY DATA
  // =====================================================

  const inventoryCategoryData =
    useMemo(() => {
      const categories = {};

      inventory.forEach((item) => {
        const category =
          item.category ||
          "Uncategorised";

        if (!categories[category]) {
          categories[category] = {
            category,
            products: 0,
            quantity: 0,
            value: 0,
          };
        }

        categories[category].products += 1;

        categories[category].quantity +=
          Number(
            item.quantity_on_hand || 0
          );

        categories[category].value +=
          Number(item.stock_value || 0);
      });

      return Object.values(categories).sort(
        (a, b) => b.value - a.value
      );
    }, [inventory]);


  // =====================================================
  // STOCK STATUS
  // =====================================================

  const stockStatusData = useMemo(() => {
    const statuses = {
      "In Stock": 0,
      "Low Stock": 0,
      "Out of Stock": 0,
    };

    inventory.forEach((item) => {
      if (
        Object.prototype.hasOwnProperty.call(
          statuses,
          item.stock_status
        )
      ) {
        statuses[item.stock_status] += 1;
      }
    });

    return Object.entries(statuses).map(
      ([name, value]) => ({
        name,
        value,
      })
    );
  }, [inventory]);


  // =====================================================
  // RECEIVING RATE
  // =====================================================

  const totalInspectedUnits =
    acceptedUnits + rejectedUnits;


  const acceptanceRate =
    totalInspectedUnits > 0
      ? (
          (acceptedUnits /
            totalInspectedUnits) *
          100
        ).toFixed(1)
      : "0.0";


  // =====================================================
  // CSV EXPORT
  // =====================================================

  const exportPurchaseOrders = () => {
    if (orders.length === 0) {
      return;
    }

    const headings = [
      "PO Number",
      "Supplier",
      "Purchase Request",
      "Order Date",
      "Expected Delivery",
      "Status",
      "Subtotal",
      "Tax",
      "Total",
    ];

    const rows = orders.map((order) => [
      order.po_number,
      order.supplier_name,
      order.request_number || "",
      order.order_date,
      order.expected_delivery_date || "",
      order.status,
      order.subtotal,
      order.tax_amount,
      order.total_amount,
    ]);

    const escapeCell = (value) => {
      const text = String(
        value ?? ""
      ).replaceAll('"', '""');

      return `"${text}"`;
    };

    const csv = [
      headings.map(escapeCell).join(","),
      ...rows.map((row) =>
        row.map(escapeCell).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "grimora-purchase-orders.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };


  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            ANALYTICS
          </p>

          <h2>Reports</h2>

          <p className="page-description">
            Analyse live procurement,
            supplier, receiving and inventory
            performance.
          </p>
        </div>

        <div className="reports-header-actions">
          <button
            className="reports-refresh-button"
            onClick={loadReports}
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            className="reports-export-button"
            onClick={exportPurchaseOrders}
            disabled={orders.length === 0}
          >
            <Download size={15} />
            Export Purchase Orders
          </button>
        </div>
      </div>


      {loading && (
        <div className="reports-state">
          Loading reporting data...
        </div>
      )}


      {!loading && error && (
        <div className="reports-state reports-error">
          {error}
        </div>
      )}


      {!loading && !error && (
        <>
          {/* ===========================================
              PRIMARY METRICS
          =========================================== */}

          <div className="reports-summary-grid">
            <div className="reports-summary-card">
              <div>
                <span>
                  Procurement Value
                </span>

                <strong>
                  {formatCurrency(
                    procurementValue
                  )}
                </strong>

                <small>
                  {orders.length} purchase
                  orders
                </small>
              </div>

              <TrendingUp size={19} />
            </div>


            <div className="reports-summary-card">
              <div>
                <span>
                  Inventory Value
                </span>

                <strong>
                  {formatCurrency(
                    inventoryValue
                  )}
                </strong>

                <small>
                  {inventory.length} stocked
                  products
                </small>
              </div>

              <Package size={19} />
            </div>


            <div className="reports-summary-card">
              <div>
                <span>
                  Active Suppliers
                </span>

                <strong>
                  {activeSuppliers}
                </strong>

                <small>
                  {suppliers.length} suppliers
                  registered
                </small>
              </div>

              <Building2 size={19} />
            </div>


            <div className="reports-summary-card">
              <div>
                <span>
                  Acceptance Rate
                </span>

                <strong>
                  {acceptanceRate}%
                </strong>

                <small>
                  {formatNumber(
                    acceptedUnits
                  )}{" "}
                  accepted units
                </small>
              </div>

              <ClipboardCheck size={19} />
            </div>
          </div>


          {/* ===========================================
              OPERATIONAL SUMMARY
          =========================================== */}

          <div className="reports-mini-grid">
            <div className="reports-mini-card">
              <ShoppingCart size={16} />

              <div>
                <span>Open Orders</span>
                <strong>{openOrders}</strong>
              </div>
            </div>


            <div className="reports-mini-card">
              <ClipboardCheck size={16} />

              <div>
                <span>
                  Received Orders
                </span>

                <strong>
                  {receivedOrders}
                </strong>
              </div>
            </div>


            <div className="reports-mini-card">
              <Package size={16} />

              <div>
                <span>
                  Completed Receipts
                </span>

                <strong>
                  {completedReceipts}
                </strong>
              </div>
            </div>


            <div className="reports-mini-card">
              <BarChart3 size={16} />

              <div>
                <span>
                  Rejected Units
                </span>

                <strong>
                  {formatNumber(
                    rejectedUnits
                  )}
                </strong>
              </div>
            </div>
          </div>


          {/* ===========================================
              CHARTS
          =========================================== */}

          <div className="reports-chart-grid">
            <div className="reports-panel">
              <div className="reports-panel-header">
                <div>
                  <h3>
                    Supplier Expenditure
                  </h3>

                  <p>
                    Purchase order value by
                    supplier.
                  </p>
                </div>
              </div>

              <div className="reports-chart">
                {supplierSpend.length === 0 ? (
                  <div className="reports-empty">
                    No purchase order data
                    available.
                  </div>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={280}
                  >
                    <BarChart
                      data={supplierSpend}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#3a3e43"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="supplier"
                        tick={{
                          fill: "#858b91",
                          fontSize: 9,
                        }}
                        axisLine={{
                          stroke: "#41454a",
                        }}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: "#858b91",
                          fontSize: 9,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(
                            value
                          )
                        }
                        contentStyle={{
                          background:
                            "#24272a",
                          border:
                            "1px solid #41454a",
                          borderRadius:
                            "7px",
                          color: "#d8dadd",
                          fontSize: "10px",
                        }}
                      />

                      <Bar
                        dataKey="value"
                        fill="#8f969d"
                        radius={[
                          4,
                          4,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>


            <div className="reports-panel">
              <div className="reports-panel-header">
                <div>
                  <h3>
                    Purchase Order Status
                  </h3>

                  <p>
                    Distribution of current
                    order statuses.
                  </p>
                </div>
              </div>

              <div className="reports-pie-area">
                {orderStatusData.length ===
                0 ? (
                  <div className="reports-empty">
                    No purchase orders
                    available.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer
                      width="100%"
                      height={220}
                    >
                      <PieChart>
                        <Pie
                          data={
                            orderStatusData
                          }
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={82}
                          paddingAngle={3}
                        >
                          {orderStatusData.map(
                            (
                              entry,
                              index
                            ) => (
                              <Cell
                                key={
                                  entry.name
                                }
                                fill={
                                  [
                                    "#7f9689",
                                    "#8b91a0",
                                    "#b29a68",
                                    "#a87979",
                                    "#858b91",
                                  ][
                                    index % 5
                                  ]
                                }
                              />
                            )
                          )}
                        </Pie>

                        <Tooltip
                          contentStyle={{
                            background:
                              "#24272a",
                            border:
                              "1px solid #41454a",
                            borderRadius:
                              "7px",
                            color:
                              "#d8dadd",
                            fontSize:
                              "10px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="reports-pie-legend">
                      {orderStatusData.map(
                        (entry) => (
                          <div
                            key={
                              entry.name
                            }
                          >
                            <span>
                              {entry.name}
                            </span>

                            <strong>
                              {entry.value}
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>


          {/* ===========================================
              INVENTORY REPORT
          =========================================== */}

          <div className="reports-panel reports-table-panel">
            <div className="reports-panel-header">
              <div>
                <h3>
                  Inventory Valuation by Category
                </h3>

                <p>
                  Quantity and current stock
                  value grouped by product
                  category.
                </p>
              </div>
            </div>

            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Products</th>
                    <th>
                      Quantity on Hand
                    </th>
                    <th>Stock Value</th>
                    <th>
                      Share of Inventory
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {inventoryCategoryData.map(
                    (category) => (
                      <tr
                        key={
                          category.category
                        }
                      >
                        <td>
                          <strong>
                            {
                              category.category
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            category.products
                          }
                        </td>

                        <td>
                          {formatNumber(
                            category.quantity
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            category.value
                          )}
                        </td>

                        <td>
                          {inventoryValue > 0
                            ? `${(
                                (category.value /
                                  inventoryValue) *
                                100
                              ).toFixed(
                                1
                              )}%`
                            : "0.0%"}
                        </td>
                      </tr>
                    )
                  )}

                  {inventoryCategoryData.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="reports-table-empty"
                      >
                        No inventory data
                        available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* ===========================================
              SUPPLIER SPEND TABLE
          =========================================== */}

          <div className="reports-panel reports-table-panel">
            <div className="reports-panel-header">
              <div>
                <h3>
                  Supplier Spend Analysis
                </h3>

                <p>
                  Procurement expenditure and
                  purchase order volume by
                  supplier.
                </p>
              </div>
            </div>

            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>
                      Purchase Orders
                    </th>
                    <th>
                      Procurement Value
                    </th>
                    <th>
                      Share of Spend
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {supplierSpend.map(
                    (supplier) => (
                      <tr
                        key={
                          supplier.supplier
                        }
                      >
                        <td>
                          <strong>
                            {
                              supplier.supplier
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            supplier.orders
                          }
                        </td>

                        <td>
                          {formatCurrency(
                            supplier.value
                          )}
                        </td>

                        <td>
                          {procurementValue > 0
                            ? `${(
                                (supplier.value /
                                  procurementValue) *
                                100
                              ).toFixed(
                                1
                              )}%`
                            : "0.0%"}
                        </td>
                      </tr>
                    )
                  )}

                  {supplierSpend.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="reports-table-empty"
                      >
                        No supplier expenditure
                        available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* ===========================================
              RECEIVING PERFORMANCE
          =========================================== */}

          <div className="reports-bottom-grid">
            <div className="reports-panel">
              <div className="reports-panel-header">
                <div>
                  <h3>
                    Stock Health
                  </h3>

                  <p>
                    Current inventory status
                    distribution.
                  </p>
                </div>
              </div>

              <div className="reports-stock-list">
                {stockStatusData.map(
                  (status) => (
                    <div
                      key={status.name}
                    >
                      <span>
                        {status.name}
                      </span>

                      <strong>
                        {status.value}
                      </strong>
                    </div>
                  )
                )}
              </div>
            </div>


            <div className="reports-panel">
              <div className="reports-panel-header">
                <div>
                  <h3>
                    Receiving Performance
                  </h3>

                  <p>
                    Inspection results from
                    completed goods receipts.
                  </p>
                </div>
              </div>

              <div className="reports-receiving-summary">
                <div>
                  <span>
                    Accepted Units
                  </span>

                  <strong>
                    {formatNumber(
                      acceptedUnits
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Rejected Units
                  </span>

                  <strong>
                    {formatNumber(
                      rejectedUnits
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Acceptance Rate
                  </span>

                  <strong>
                    {acceptanceRate}%
                  </strong>
                </div>

                <div>
                  <span>
                    Last Receipt
                  </span>

                  <strong>
                    {receipts.length > 0
                      ? formatDate(
                          [...receipts].sort(
                            (a, b) =>
                              Number(b.id) -
                              Number(a.id)
                          )[0]
                            .receipt_date
                        )
                      : "—"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


export default Reports;