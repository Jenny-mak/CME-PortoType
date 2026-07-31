"use client";

import { FormEvent, useState } from "react";
import { authenticate, PublicUser } from "@/lib/users";

export function LoginPage({ onSuccess }: { onSuccess: (user: PublicUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const user = authenticate(username, password);
    window.setTimeout(() => {
      if (!user) {
        setError("Invalid username or password. Please try again.");
        setSubmitting(false);
        return;
      }
      onSuccess(user);
    }, 280);
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden="true" />
      <div className="login-shell">
        <aside className="login-brand">
          <div className="login-brand-mark">CRM</div>
          <h1>Commercial Banking Workspace</h1>
          <p>Sign in to manage clients, contacts, loans, and campaigns across your business unit.</p>
        </aside>

        <section className="login-card">
          <header className="login-card-header">
            <h2>Sign in</h2>
            <p>Use your demo account credentials to continue.</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Username</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                required
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
            </label>

            {error ? <p className="login-error">{error}</p> : null}

            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="login-hint">
            <strong>Demo accounts</strong>
            <p>Zhangwei / Lina / Roy / Lily / Huayi / Developer — password: password</p>
          </div>
        </section>
      </div>
    </div>
  );
}
