"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminBranding, getSystemHealth, updateAdminBranding, type BrandingSettings } from "@/lib/api";

type ServiceStatus = {
  status: string;
  latency_ms?: number;
  url?: string;
  error?: string;
  http_status?: number;
  provider?: string;
  latest_migration?: string;
};

type HealthResponse = {
  status: string;
  timestamp: string;
  services: Record<string, ServiceStatus>;
};

const SERVICE_META: Record<string, { label: string; description: string }> = {
  backend: { label: "Backend API", description: "NestJS API server" },
  database: { label: "PostgreSQL", description: "Primary database" },
  artifact_storage: {
    label: "Artifact Storage",
    description: "Screenshots & trace storage",
  },
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "up"
      ? "bg-[var(--success)]"
      : status === "misconfigured"
        ? "bg-[var(--warning)]"
        : "bg-[var(--error)]";
  const pulse = status === "up" ? "animate-pulse" : "";
  return (
    <span className="relative flex h-3 w-3">
      {status === "up" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 ${pulse}`}
        />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${color}`} />
    </span>
  );
}

function ServiceCard({
  serviceKey,
  data,
}: {
  serviceKey: string;
  data: ServiceStatus;
}) {
  const meta = SERVICE_META[serviceKey] || {
    label: serviceKey,
    description: "",
  };
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusDot status={data.status} />
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
              {meta.label}
            </h3>
            <p className="text-[13px] text-[var(--muted)]">
              {meta.description}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider ${
            data.status === "up"
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : data.status === "misconfigured"
                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                : "bg-[var(--error-soft)] text-[var(--error)]"
          }`}
        >
          {data.status}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        {data.latency_ms !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted)]">Latency</span>
            <span className="font-medium text-[var(--foreground)]">
              {data.latency_ms}ms
            </span>
          </div>
        )}
        {data.provider && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted)]">Provider</span>
            <span className="font-medium text-[var(--foreground)]">
              {data.provider}
            </span>
          </div>
        )}
        {data.latest_migration && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted)]">Migration</span>
            <span className="font-medium text-[var(--foreground)]">
              {data.latest_migration}
            </span>
          </div>
        )}
        {data.url && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted)]">URL</span>
            <span className="font-mono text-[12px] text-[var(--foreground)]">
              {data.url}
            </span>
          </div>
        )}
      </div>

      {data.error && (
        <div className="rounded-lg bg-[var(--error-soft)] px-3 py-2 text-[13px] text-[var(--error)]">
          {data.error}
        </div>
      )}
    </div>
  );
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>({ productName: "Tesbo Test Manager", logoUrl: "/tesbo-test-manager-logo.png" });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data);
      setError(null);
      setLastChecked(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    getAdminBranding()
      .then(setBranding)
      .catch(() => undefined);
  }, [fetchHealth]);

  async function handleLogoFile(file: File | null) {
    setBrandingMessage(null);
    setBrandingError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingError("Upload a PNG, JPG, SVG, or WebP logo.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingError("Logo must be below 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBranding((current) => ({ ...current, logoUrl: String(reader.result || "") }));
    };
    reader.onerror = () => setBrandingError("Failed to read logo file.");
    reader.readAsDataURL(file);
  }

  async function handleSaveBranding() {
    setBrandingSaving(true);
    setBrandingMessage(null);
    setBrandingError(null);
    try {
      const saved = await updateAdminBranding(branding);
      setBranding(saved);
      setBrandingMessage("Branding saved. Refresh open app tabs to see the new logo.");
    } catch (e) {
      setBrandingError(e instanceof Error ? e.message : "Failed to save branding.");
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleResetBranding() {
    const next = { productName: "Tesbo Test Manager", logoUrl: "/tesbo-test-manager-logo.png" };
    setBranding(next);
    setBrandingSaving(true);
    setBrandingMessage(null);
    setBrandingError(null);
    try {
      const saved = await updateAdminBranding(next);
      setBranding(saved);
      setBrandingMessage("Branding reset to the default logo.");
    } catch (e) {
      setBrandingError(e instanceof Error ? e.message : "Failed to reset branding.");
    } finally {
      setBrandingSaving(false);
    }
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const serviceEntries = health?.services
    ? Object.entries(health.services)
    : [];
  const upCount = serviceEntries.filter(
    ([, s]) => s.status === "up"
  ).length;
  const totalCount = serviceEntries.length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--foreground)]">
            System Health
          </h1>
          <p className="mt-1 text-[15px] text-[var(--muted)]">
            Post-deployment service status and connectivity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[var(--border)] bg-[var(--surface)] accent-[var(--brand-primary)]"
            />
            Auto-refresh (30s)
          </label>
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-60"
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-[var(--error)] bg-[var(--error-soft)] p-4 text-[14px] text-[var(--error)]">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--foreground)]">Deployment branding</h2>
            <p className="mt-1 text-[13px] text-[var(--muted)]">Upload the logo shown on login, setup, shared reports, and the app sidebar.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
            <img src={branding.logoUrl || "/tesbo-test-manager-logo.png"} alt="Current logo" className="h-10 max-w-[170px] object-contain" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--foreground)]">Product name</span>
            <input
              value={branding.productName}
              onChange={(event) => setBranding((current) => ({ ...current, productName: event.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]">
            Upload logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="sr-only"
              onChange={(event) => void handleLogoFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>
        {branding.logoUrl && (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-4">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Preview</p>
            <img src={branding.logoUrl} alt="Logo preview" className="h-16 max-w-[260px] object-contain" />
          </div>
        )}
        {brandingError && <p className="mt-3 rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{brandingError}</p>}
        {brandingMessage && <p className="mt-3 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{brandingMessage}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveBranding}
            disabled={brandingSaving}
            className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {brandingSaving ? "Saving..." : "Save branding"}
          </button>
          <button
            type="button"
            onClick={handleResetBranding}
            disabled={brandingSaving}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] disabled:opacity-60"
          >
            Reset default
          </button>
        </div>
      </section>

      {/* Overall status banner */}
      {health && (
        <div
          className={`rounded-2xl border p-5 flex items-center justify-between ${
            health.status === "healthy"
              ? "border-[var(--success)]/30 bg-[var(--success-soft)]"
              : "border-[var(--warning)]/30 bg-[var(--warning-soft)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <StatusDot status={health.status === "healthy" ? "up" : "down"} />
            <div>
              <span className="text-[16px] font-bold text-[var(--foreground)]">
                {health.status === "healthy"
                  ? "All Systems Operational"
                  : "System Degraded"}
              </span>
              <p className="text-[13px] text-[var(--muted)]">
                {upCount}/{totalCount} services healthy
              </p>
            </div>
          </div>
          {lastChecked && (
            <span className="text-[13px] text-[var(--muted)]">
              Last checked:{" "}
              {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Service cards */}
      {loading && !health ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[140px] animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceEntries.map(([key, data]) => (
            <ServiceCard key={key} serviceKey={key} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
