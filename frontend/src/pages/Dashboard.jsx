import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {

  AlertTriangle,

  BarChart3,

  Building2,

  ClipboardList,

  Package,

  PackageCheck,

  RefreshCw,

  ShoppingCart,

  TrendingUp,

  Truck,

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

import { useAuth } from "../auth/AuthContext";
import API_BASE_URL from "../config/api";

import "./Dashboard.css";

const API = API_BASE_URL;

const endpoints = [

  "/purchase-requests",

  "/purchase-orders",

  "/inventory",

  "/suppliers",

  "/goods-receipts",

];

const formatCurrency = (value) =>

  new Intl.NumberFormat("en-KE", {

    style: "currency",

    currency: "KES",

    maximumFractionDigits: 0,

  }).format(Number(value || 0));

const formatDate = (value) =>

  value

    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {

        dateStyle: "medium",

      })

    : "—";

const formatStatus = (value) =>

  String(value || "Unknown")

    .replaceAll("_", " ")

    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function Dashboard() {

  const navigate = useNavigate();

  const { token, user, logout } = useAuth();

  const [requests, setRequests] = useState([]);

  const [orders, setOrders] = useState([]);

  const [inventory, setInventory] = useState([]);

  const [suppliers, setSuppliers] = useState([]);

  const [receipts, setReceipts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const canCreate = [

    "admin",

    "procurement_officer",

    "requester",

  ].includes(user?.role);

  const loadDashboard = useCallback(async () => {

    if (!token) return;

    setLoading(true);

    setError("");

    try {

      const responses = await Promise.all(

        endpoints.map((endpoint) =>

          fetch(`${API}${endpoint}`, {

            headers: {

              Authorization: `Bearer ${token}`,

            },

          })

        )

      );

      if (responses.some((response) => response.status === 401)) {

        logout();

        throw new Error(

          "Your session has expired. Please sign in again."

        );

      }

      const failedIndex = responses.findIndex(

        (response) => !response.ok

      );

      if (failedIndex !== -1) {

        throw new Error(

          `Unable to retrieve ${endpoints[failedIndex]

            .slice(1)

            .replaceAll("-", " ")} data (${responses[failedIndex].status}).`

        );

      }

      const [

        requestData,

        orderData,

        inventoryData,

        supplierData,

        receiptData,

      ] = await Promise.all(

        responses.map((response) => response.json())

      );

      setRequests(requestData);

      setOrders(orderData);

      setInventory(inventoryData);

      setSuppliers(supplierData);

      setReceipts(receiptData);

    } catch (err) {

      setError(

        err.message || "Could not connect to the GRIMORA API."

      );

    } finally {

      setLoading(false);

    }

  }, [token, logout]);

  useEffect(() => {

    loadDashboard();

  }, [loadDashboard]);

  const pendingRequests = requests.filter(

    (request) => request.status === "submitted"

  ).length;

  const openOrders = orders.filter(

    (order) =>

      !["received", "cancelled"].includes(order.status)

  ).length;

  const inventoryValue = inventory.reduce(

    (total, item) => total + Number(item.stock_value || 0),

    0

  );

  const lowStockItems = inventory.filter(

    (item) => item.stock_status === "Low Stock"

  );

  const outOfStockItems = inventory.filter(

    (item) => item.stock_status === "Out of Stock"

  );

  const activeSuppliers = suppliers.filter(

    (supplier) => supplier.status === "active"

  ).length;

  const procurementValue = orders.reduce(

    (total, order) =>

      total + Number(order.total_amount || 0),

    0

  );

  const receivedOrders = orders.filter(

    (order) => order.status === "received"

  ).length;

  const stockStatusData = useMemo(

    () =>

      ["In Stock", "Low Stock", "Out of Stock"].map(

        (name) => ({

          name,

          value: inventory.filter(

            (item) => item.stock_status === name

          ).length,

        })

      ),

    [inventory]

  );

  const categoryData = useMemo(() => {

    const categories = {};

    inventory.forEach((item) => {

      const category = item.category || "Uncategorised";

      categories[category] =

        (categories[category] || 0) +

        Number(item.stock_value || 0);

    });

    return Object.entries(categories).map(([name, value]) => ({

      name,

      value,

    }));

  }, [inventory]);

  const recentRequests = [...requests]

    .sort((a, b) => Number(b.id) - Number(a.id))

    .slice(0, 4);

  const recentOrders = [...orders]

    .sort((a, b) => Number(b.id) - Number(a.id))

    .slice(0, 4);

  const recentReceipts = [...receipts]

    .sort((a, b) => Number(b.id) - Number(a.id))

    .slice(0, 4);

  const firstName =

    user?.full_name?.split(" ")[0] || "Admin";

  const stats = [

    {

      label: "Pending Requests",

      value: pendingRequests,

      description: `${requests.length} total requests`,

      Icon: ClipboardList,

    },

    {

      label: "Open Purchase Orders",

      value: openOrders,

      description: `${orders.length} total orders`,

      Icon: ShoppingCart,

    },

    {

      label: "Inventory Value",

      value: formatCurrency(inventoryValue),

      description: `${inventory.length} stocked products`,

      Icon: Package,

      money: true,

    },

    {

      label: "Low Stock Items",

      value: lowStockItems.length,

      description: `${outOfStockItems.length} out of stock`,

      Icon: BarChart3,

      warning: true,

    },

  ];

  const miniStats = [

    {

      label: "Active Suppliers",

      value: activeSuppliers,

      Icon: Building2,

    },

    {

      label: "Procurement Value",

      value: formatCurrency(procurementValue),

      Icon: TrendingUp,

    },

    {

      label: "Goods Receipts",

      value: receipts.length,

      Icon: PackageCheck,

    },

    {

      label: "Received Orders",

      value: receivedOrders,

      Icon: Truck,

    },

  ];

  const tooltipStyle = {

    background: "#24272a",

    border: "1px solid #41454a",

    borderRadius: "7px",

    color: "#d8dadd",

    fontSize: "10px",

  };

  return (

    <div className="page-content">

      <div className="page-header">

        <div>

          <p className="eyebrow">OVERVIEW</p>

          <h2>Good morning, {firstName}</h2>

          <p className="page-description">

            Monitor live procurement, inventory and supplier

            operations.

          </p>

        </div>

        <div className="dashboard-header-actions">

          <button

            type="button"

            className="dashboard-refresh-button"

            onClick={loadDashboard}

          >

            <RefreshCw size={15} />

            Refresh

          </button>

          {canCreate && (

            <button

              type="button"

              className="primary-button"

              onClick={() => navigate("/purchase-requests")}

            >

              + New Purchase Request

            </button>

          )}

        </div>

      </div>

      {loading && (

        <div className="dashboard-message">

          Loading live GRIMORA data...

        </div>

      )}

      {!loading && error && (

        <div className="dashboard-message dashboard-error">

          {error}

        </div>

      )}

      {!loading && !error && (

        <>

          <div className="stats-grid">

            {stats.map(

              ({

                label,

                value,

                description,

                Icon,

                money,

                warning,

              }) => (

                <div className="stat-card" key={label}>

                  <div className="stat-top">

                    <span>{label}</span>

                    <div

                      className={`stat-icon ${

                        warning ? "warning" : ""

                      }`}

                    >

                      <Icon size={19} />

                    </div>

                  </div>

                  <div

                    className={`stat-value ${

                      money ? "dashboard-money" : ""

                    }`}

                  >

                    {value}

                  </div>

                  <div

                    className={`stat-change ${

                      warning ? "warning-text" : ""

                    }`}

                  >

                    {description}

                  </div>

                </div>

              )

            )}

          </div>

          <div className="dashboard-mini-grid">

            {miniStats.map(({ label, value, Icon }) => (

              <div className="dashboard-mini-card" key={label}>

                <Icon size={17} />

                <div>

                  <span>{label}</span>

                  <strong>{value}</strong>

                </div>

              </div>

            ))}

          </div>

          <div className="dashboard-chart-grid">

            <div className="dashboard-panel">

              <div className="dashboard-panel-header">

                <div>

                  <h3>Inventory Value by Category</h3>

                  <p>

                    Current stock value grouped by product

                    category.

                  </p>

                </div>

              </div>

              <div className="dashboard-chart">

                {categoryData.length === 0 ? (

                  <div className="dashboard-empty">

                    No inventory data available.

                  </div>

                ) : (

                  <ResponsiveContainer

                    width="100%"

                    height={260}

                  >

                    <BarChart data={categoryData}>

                      <CartesianGrid

                        strokeDasharray="3 3"

                        stroke="#3a3e43"

                        vertical={false}

                      />

                      <XAxis

                        dataKey="name"

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

                          formatCurrency(value)

                        }

                        contentStyle={tooltipStyle}

                      />

                      <Bar

                        dataKey="value"

                        fill="#8f969d"

                        radius={[4, 4, 0, 0]}

                      />

                    </BarChart>

                  </ResponsiveContainer>

                )}

              </div>

            </div>

            <div className="dashboard-panel">

              <div className="dashboard-panel-header">

                <div>

                  <h3>Stock Status</h3>

                  <p>

                    Current inventory health across all

                    products.

                  </p>

                </div>

              </div>

              <div className="dashboard-chart dashboard-pie-area">

                <ResponsiveContainer

                  width="100%"

                  height={220}

                >

                  <PieChart>

                    <Pie

                      data={stockStatusData}

                      dataKey="value"

                      nameKey="name"

                      innerRadius={55}

                      outerRadius={82}

                      paddingAngle={3}

                    >

                      {stockStatusData.map((entry, index) => (

                        <Cell

                          key={entry.name}

                          fill={

                            [

                              "#7f9689",

                              "#b29a68",

                              "#a87979",

                            ][index]

                          }

                        />

                      ))}

                    </Pie>

                    <Tooltip contentStyle={tooltipStyle} />

                  </PieChart>

                </ResponsiveContainer>

                <div className="dashboard-legend">

                  {stockStatusData.map((entry, index) => (

                    <div key={entry.name}>

                      <span

                        className={`dashboard-dot dashboard-dot-${index}`}

                      />

                      <span>{entry.name}</span>

                      <strong>{entry.value}</strong>

                    </div>

                  ))}

                </div>

              </div>

            </div>

          </div>

          <div className="dashboard-activity-grid">

            <div className="dashboard-panel">

              <div className="dashboard-panel-header">

                <div>

                  <h3>Recent Purchase Requests</h3>

                  <p>

                    Latest internal procurement requirements.

                  </p>

                </div>

                <button

                  type="button"

                  onClick={() =>

                    navigate("/purchase-requests")

                  }

                >

                  View All

                </button>

              </div>

              <div className="dashboard-list">

                {recentRequests.map((request) => (

                  <div

                    className="dashboard-list-row"

                    key={request.id}

                  >

                    <div>

                      <strong>

                        {request.request_number}

                      </strong>

                      <span>

                        {request.department ||

                          "No department"}

                      </span>

                    </div>

                    <div className="dashboard-list-right">

                      <strong>

                        {formatCurrency(

                          request.estimated_total

                        )}

                      </strong>

                      <span

                        className={`dashboard-status dashboard-status-${request.status}`}

                      >

                        {formatStatus(request.status)}

                      </span>

                    </div>

                  </div>

                ))}

                {recentRequests.length === 0 && (

                  <div className="dashboard-empty">

                    No purchase requests.

                  </div>

                )}

              </div>

            </div>

            <div className="dashboard-panel">

              <div className="dashboard-panel-header">

                <div>

                  <h3>Recent Purchase Orders</h3>

                  <p>

                    Latest supplier orders and delivery

                    status.

                  </p>

                </div>

                <button

                  type="button"

                  onClick={() =>

                    navigate("/purchase-orders")

                  }

                >

                  View All

                </button>

              </div>

              <div className="dashboard-list">

                {recentOrders.map((order) => (

                  <div

                    className="dashboard-list-row"

                    key={order.id}

                  >

                    <div>

                      <strong>{order.po_number}</strong>

                      <span>{order.supplier_name}</span>

                    </div>

                    <div className="dashboard-list-right">

                      <strong>

                        {formatCurrency(

                          order.total_amount

                        )}

                      </strong>

                      <span

                        className={`dashboard-status dashboard-status-${order.status}`}

                      >

                        {formatStatus(order.status)}

                      </span>

                    </div>

                  </div>

                ))}

                {recentOrders.length === 0 && (

                  <div className="dashboard-empty">

                    No purchase orders.

                  </div>

                )}

              </div>

            </div>

            <div className="dashboard-panel dashboard-receipts-panel">

              <div className="dashboard-panel-header">

                <div>

                  <h3>Recent Goods Receipts</h3>

                  <p>

                    Latest stock received from suppliers.

                  </p>

                </div>

                <button

                  type="button"

                  onClick={() => navigate("/receiving")}

                >

                  View All

                </button>

              </div>

              <div className="dashboard-list">

                {recentReceipts.map((receipt) => (

                  <div

                    className="dashboard-list-row"

                    key={receipt.id}

                  >

                    <div>

                      <strong>

                        {receipt.receipt_number}

                      </strong>

                      <span>{receipt.po_number}</span>

                    </div>

                    <div className="dashboard-list-right">

                      <strong>

                        {(receipt.items || []).reduce(

                          (total, item) =>

                            total +

                            Number(

                              item.accepted_quantity || 0

                            ),

                          0

                        )}{" "}

                        accepted

                      </strong>

                      <span>

                        {formatDate(

                          receipt.receipt_date

                        )}

                      </span>

                    </div>

                  </div>

                ))}

                {recentReceipts.length === 0 && (

                  <div className="dashboard-empty">

                    No goods receipts.

                  </div>

                )}

              </div>

            </div>

          </div>

          {(lowStockItems.length > 0 ||

            outOfStockItems.length > 0) && (

            <div className="dashboard-stock-alert">

              <div className="dashboard-stock-alert-title">

                <AlertTriangle size={17} />

                <div>

                  <strong>Inventory Attention</strong>

                  <span>

                    Products at or below their reorder

                    threshold.

                  </span>

                </div>

              </div>

              <div className="dashboard-alert-products">

                {[

                  ...outOfStockItems,

                  ...lowStockItems,

                ].map((item) => (

                  <div key={item.id}>

                    <strong>{item.product_name}</strong>

                    <span>

                      {item.quantity_on_hand} on hand ·

                      Reorder at {item.reorder_level}

                    </span>

                  </div>

                ))}

              </div>

            </div>

          )}

        </>

      )}

    </div>

  );

}

export default Dashboard;
