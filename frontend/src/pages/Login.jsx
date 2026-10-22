import { useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import "./Login.css";


function Login() {
  const {
    login,
    isAuthenticated,
  } = useAuth();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  if (isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(
        email.trim(),
        password
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to sign in."
      );
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-background-mark">
        G
      </div>

      <div className="login-container">
        <section className="login-brand-panel">
          <div className="login-brand">
            <div className="login-brand-mark">
              G
            </div>

            <div>
              <h1>GRIMORA</h1>
              <span>
                Procurement Suite
              </span>
            </div>
          </div>

          <div className="login-intro">
            <p className="login-eyebrow">
              PROCUREMENT & INVENTORY
            </p>

            <h2>
              Control procurement from
              request to receipt.
            </h2>

            <p>
              A unified workspace for
              purchase requests, suppliers,
              orders, receiving, inventory
              and management reporting.
            </p>
          </div>

          <div className="login-feature-list">
            <div>
              <ShieldCheck size={17} />

              <span>
                Secure role-based access
              </span>
            </div>

            <div>
              <LockKeyhole size={17} />

              <span>
                JWT authenticated sessions
              </span>
            </div>
          </div>

          <div className="login-brand-footer">
            GRIMORA v1.0
          </div>
        </section>


        <section className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="login-form-heading">
              <p>SECURE ACCESS</p>

              <h2>Sign in</h2>

              <span>
                Enter your GRIMORA account
                credentials to continue.
              </span>
            </div>


            {error && (
              <div className="login-error">
                {error}
              </div>
            )}


            <form
              onSubmit={handleSubmit}
              className="login-form"
            >
              <label>
                Email address

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="name@organisation.com"
                  autoComplete="email"
                  required
                />
              </label>


              <label>
                Password

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>


              <button
                type="submit"
                className="login-submit-button"
                disabled={submitting}
              >
                <span>
                  {submitting
                    ? "Signing in..."
                    : "Sign in to GRIMORA"}
                </span>

                {!submitting && (
                  <ArrowRight size={17} />
                )}
              </button>
            </form>


            <div className="login-security-note">
              <LockKeyhole size={14} />

              <span>
                Access is restricted to
                authorised GRIMORA users.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


export default Login;