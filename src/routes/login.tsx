import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Lock, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { store } from "@/lib/ms/store";
import type { Role } from "@/lib/ms/types";
import { Brand } from "@/components/ms/AppShell";
import { HOME, ROLE_LABEL } from "@/components/ms/nav";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · MARISENTINEL Coastal Security" },
      { name: "description", content: "Secure sign-in for MARISENTINEL administrator, command officer and field officer consoles." },
      { property: "og:title", content: "Sign in · MARISENTINEL" },
      { property: "og:description", content: "Role-based access to the maritime intelligence command platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.hydrate();
  }, []);

  function handleRoleChange(newRole: Role | "") {
    setRole(newRole);
    setError("");
    if (newRole === "administrator") {
      setUsername("admin");
      setPassword("admin123");
    } else if (newRole === "command") {
      setUsername("command");
      setPassword("command123");
    } else if (newRole === "field") {
      setUsername("field");
      setPassword("field123");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please select a role or enter credentials.");
      return;
    }
    setBusy(true);
    setStatus("Verifying credentials…");
    setTimeout(() => {
      const res = store.login(username, password, role);
      setBusy(false);
      if (!res.ok || !res.role) {
        setStatus("");
        setError(res.error ?? "Sign-in failed.");
        return;
      }
      setStatus(`Authenticated. Opening ${ROLE_LABEL[res.role]} console…`);
      toast.success(`Welcome, ${ROLE_LABEL[res.role]}`);
      navigate({ to: HOME[res.role] });
    }, 300);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />

      <div className="glass relative z-10 w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex justify-center pb-2">
          <Brand />
        </div>

        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Secure sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Authorized coastal security personnel only.</p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Select Role</span>
            <div className="relative mt-1.5">
              <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as Role | "")}
                className="w-full rounded-md border border-input bg-surface/70 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
              >
                <option value="">Choose a role </option>
                <option value="administrator">Administrator</option>
                <option value="command">Command Officer</option>
                <option value="field">Field Officer</option>
              </select>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Username or email</span>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Username"
                className="w-full rounded-md border border-input bg-surface/70 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Password</span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-surface/70 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
              />
            </div>
          </label>

          {error ? (
            <p className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
          {status && !error ? (
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{status}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg disabled:opacity-60"
          >
            {busy ? "Authenticating…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            ← Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}

