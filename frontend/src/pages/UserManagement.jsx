
import { useCallback, useEffect, useState } from "react";

import {
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

// Uses VITE_API_BASE_URL in production.
// Defaults to the local FastAPI backend during development.
const API = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const ROLES = [
  "admin",
  "procurement_officer",
  "requester",
  "approver",
  "storekeeper",
];

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  role: "requester",
  department: "",
};

const formatRole = (role) =>
  role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function UserManagement() {
  const { token, user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const apiFetch = useCallback(
    async (path, options = {}) => {
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
          "Session expired. Please sign in again."
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user?.role, loadUsers]);

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const created = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          department: form.department.trim() || null,
        }),
      });

      setUsers((previous) => [...previous, created]);
      setForm(emptyForm);
      setShowCreate(false);
      setSuccess("User account created successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (account, role) => {
    setBusyId(account.id);
    setError("");
    setSuccess("");

    try {
      const updated = await apiFetch(
        `/users/${account.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        }
      );

      setUsers((previous) =>
        previous.map((entry) =>
          entry.id === updated.id ? updated : entry
        )
      );

      setSuccess("User role updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (account) => {
    setBusyId(account.id);
    setError("");
    setSuccess("");

    try {
      const updated = await apiFetch(
        `/users/${account.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_active: !account.is_active,
          }),
        }
      );

      setUsers((previous) =>
        previous.map((entry) =>
          entry.id === updated.id ? updated : entry
        )
      );

      setSuccess("Account status updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="page-content">
        <h2>Access Denied</h2>
        <p>Administrator access is required.</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            SYSTEM ADMINISTRATION
          </p>
          <h2>User Management</h2>
          <p className="page-description">
            Manage GRIMORA accounts, roles and access.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setForm(emptyForm);
            setError("");
            setShowCreate(true);
          }}
        >
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      {success && (
        <div className="pr-success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {error && (
        <div className="pr-form-error">
          {error}
        </div>
      )}

      <div className="pr-summary-grid">
        <div className="pr-summary-card">
          <span>Total Users</span>
          <strong>{users.length}</strong>
          <Users size={18} />
        </div>

        <div className="pr-summary-card">
          <span>Active Users</span>
          <strong>
            {users.filter(
              (account) => account.is_active
            ).length}
          </strong>
          <CheckCircle2 size={18} />
        </div>

        <div className="pr-summary-card">
          <span>Administrators</span>
          <strong>
            {users.filter(
              (account) => account.role === "admin"
            ).length}
          </strong>
          <ShieldCheck size={18} />
        </div>
      </div>

      <div className="pr-panel">
        <div className="pr-toolbar">
          <div>
            <h3>Registered Users</h3>
            <p>Manage access and account status</p>
          </div>

          <button
            className="refresh-button"
            onClick={loadUsers}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="pr-state">
            Loading users...
          </div>
        ) : (
          <div className="pr-table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((account) => {
                  const isSelf =
                    account.id === user.id;

                  return (
                    <tr key={account.id}>
                      <td>
                        <strong>
                          {account.full_name}
                        </strong>
                      </td>
                      <td>{account.email}</td>
                      <td>
                        {account.department || "—"}
                      </td>

                      <td>
                        <select
                          value={account.role}
                          disabled={
                            isSelf ||
                            busyId === account.id
                          }
                          onChange={(event) =>
                            changeRole(
                              account,
                              event.target.value
                            )
                          }
                        >
                          {ROLES.map((role) => (
                            <option
                              key={role}
                              value={role}
                            >
                              {formatRole(role)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <span
                          className={`pr-status pr-status-${
                            account.is_active
                              ? "approved"
                              : "rejected"
                          }`}
                        >
                          {account.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={
                            isSelf ||
                            busyId === account.id
                          }
                          onClick={() =>
                            changeStatus(account)
                          }
                        >
                          {account.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="pr-modal-overlay">
          <div className="pr-modal">
            <div className="pr-modal-header">
              <div>
                <p className="eyebrow">
                  NEW ACCOUNT
                </p>
                <h3>Create User</h3>
              </div>

              <button
                className="pr-close"
                disabled={saving}
                onClick={() =>
                  setShowCreate(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="pr-form"
              onSubmit={createUser}
            >
              <div className="pr-form-grid">
                <div className="pr-field">
                  <label>Full Name</label>
                  <input
                    required
                    minLength={2}
                    value={form.full_name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        full_name:
                          event.target.value,
                      })
                    }
                  />
                </div>

                <div className="pr-field">
                  <label>Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        email: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="pr-field">
                  <label>
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        password:
                          event.target.value,
                      })
                    }
                  />
                </div>

                <div className="pr-field">
                  <label>Department</label>
                  <input
                    value={form.department}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        department:
                          event.target.value,
                      })
                    }
                  />
                </div>

                <div className="pr-field">
                  <label>Role</label>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role: event.target.value,
                      })
                    }
                  >
                    {ROLES.map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pr-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() =>
                    setShowCreate(false)
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
                    ? "Creating..."
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
