"use client";

import { useCallback, useEffect, useState } from "react";
import { getWorkspace, updateWorkspace } from "@/lib/api";
import { Button, Card, Field, FieldError, FieldLabel, Input } from "@/components/ui";

export default function GeneralTab() {
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const workspace = await getWorkspace();
      setName(workspace.name || "");
      setSavedName(workspace.name || "");
    } catch (e) {
      setError((e as Error).message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required");
      return;
    }
    if (trimmed === savedName) return;
    setSaving(true);
    try {
      await updateWorkspace({ name: trimmed });
      showToast("Workspace name updated");
      // Sidebar, workspace switcher, and this page's header all read the name
      // from separate client-side fetches — reload so they all pick it up.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workspace name");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--foreground)]">General</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Basic details for this workspace.
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-[var(--radius-control)] bg-[var(--ink-800)] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <Field>
            <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
            <Input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Team"
              disabled={saving}
              maxLength={255}
            />
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !name.trim() || name.trim() === savedName}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
