
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";

import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import {
  AuthProvider,
  useAuth,
} from "./auth/AuthContext";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Products from "./pages/Products";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseRequests from "./pages/PurchaseRequests";
import Receiving from "./pages/Receiving";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Suppliers from "./pages/Suppliers";
import UserManagement from "./pages/UserManagement";

import "./App.css";


function formatRole(role) {
  if (!role) {
    return "";
  }

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


function getInitials(name) {
  if (!name) {
    return "GU";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}


function Sidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          G
        </div>

        <div>
          <h1>GRIMORA</h1>
          <span>
            Procurement Suite
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-label">
          MAIN
        </p>

        <NavLink
          to="/"
          end
          className="nav-item"
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/purchase-requests"
          className="nav-item"
        >
          <ClipboardList size={19} />
          <span>
            Purchase Requests
          </span>
        </NavLink>

        <NavLink
          to="/purchase-orders"
          className="nav-item"
        >
          <ShoppingCart size={19} />
          <span>
            Purchase Orders
          </span>
        </NavLink>

        <p className="nav-label section-label">
          MANAGEMENT
        </p>

        <NavLink
          to="/suppliers"
          className="nav-item"
        >
          <Users size={19} />
          <span>Suppliers</span>
        </NavLink>

        <NavLink
          to="/products"
          className="nav-item"
        >
          <Package size={19} />
          <span>Products</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className="nav-item"
        >
          <Warehouse size={19} />
          <span>Inventory</span>
        </NavLink>

        <NavLink
          to="/receiving"
          className="nav-item"
        >
          <Truck size={19} />
          <span>Receiving</span>
        </NavLink>

        <p className="nav-label section-label">
          ANALYTICS
        </p>

        <NavLink
          to="/reports"
          className="nav-item"
        >
          <BarChart3 size={19} />
          <span>Reports</span>
        </NavLink>

        <p className="nav-label section-label">
          SYSTEM
        </p>

        {isAdmin && (
          <NavLink
            to="/user-management"
            className="nav-item"
          >
            <UserCog size={19} />
            <span>
              User Management
            </span>
          </NavLink>
        )}

        <NavLink
          to="/settings"
          className="nav-item"
        >
          <Settings size={19} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot" />
          <span>
            System operational
          </span>
        </div>

        <div className="version">
          GRIMORA v1.0
        </div>
      </div>
    </aside>
  );
}


function Topbar() {
  const {
    user,
    logout,
  } = useAuth();

  return (
    <header className="topbar">
      <div className="search-box">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search suppliers, orders, products..."
        />

        <span className="search-shortcut">
          Ctrl K
        </span>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
        >
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <div className="profile">
          <div className="avatar">
            {getInitials(
              user?.full_name
            )}
          </div>

          <div className="profile-info">
            <strong>
              {user?.full_name}
            </strong>

            <span>
              {formatRole(
                user?.role
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}


function LoadingScreen() {
  return (
    <div className="login-page">
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#858b91",
          fontSize: "11px",
        }}
      >
        Verifying GRIMORA session...
      </div>
    </div>
  );
}


function AdminRoute({ children }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}


function ProtectedLayout() {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-area">
        <Topbar />

        <Routes>
          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/purchase-requests"
            element={
              <PurchaseRequests />
            }
          />

          <Route
            path="/purchase-orders"
            element={
              <PurchaseOrders />
            }
          />

          <Route
            path="/suppliers"
            element={<Suppliers />}
          />

          <Route
            path="/products"
            element={<Products />}
          />

          <Route
            path="/inventory"
            element={<Inventory />}
          />

          <Route
            path="/receiving"
            element={<Receiving />}
          />

          <Route
            path="/reports"
            element={<Reports />}
          />

          <Route
            path="/user-management"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <SettingsPage />
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}


function AppRoutes() {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate
              to="/"
              replace
            />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedLayout />
        }
      />
    </Routes>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}


export default App;
