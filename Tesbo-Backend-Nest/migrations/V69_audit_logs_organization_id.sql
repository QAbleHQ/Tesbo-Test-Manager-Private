-- Adds organization_id to audit_logs so a single query can scope activity across an
-- entire workspace instead of one project at a time (powers the new workspace-level
-- Activity screen). Nullable: rows written by AuditService.log() (login/logout/signup,
-- no project context) have no deterministic single org, since a user can belong to
-- multiple organizations.

ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);

-- Backfill historical rows that do have a project_id, deriving organization_id from
-- projects.organization_id. audit_logs is append-only (V62_audit_logs_immutable.sql): a
-- BEFORE UPDATE trigger unconditionally rejects UPDATEs, but per that migration's own
-- comment this is only meant to stop the runtime `tesbo_app` role, not the
-- owning/migration role this script runs as (migrate.ts applies every file as that
-- role, inside one transaction). Disable the trigger for this backfill only, then
-- re-enable it before COMMIT; if anything in this file fails, the whole transaction
-- (including the disable) rolls back and the trigger is left exactly as it was.
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable;

UPDATE audit_logs a
SET organization_id = p.organization_id
FROM projects p
WHERE a.project_id = p.id AND a.organization_id IS NULL;

ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable;
