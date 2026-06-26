-- Extend invitations table with status, invited_by, cancelled_at, updated_at, project_ids
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS project_ids TEXT[] NOT NULL DEFAULT '{}';

-- Back-fill status from existing data
UPDATE invitations SET status = 'accepted' WHERE accepted_at IS NOT NULL AND status = 'pending';
UPDATE invitations SET status = 'expired'  WHERE expires_at < now() AND status = 'pending';

-- Rename 'member' role to 'qa_engineer' in organization_members
UPDATE organization_members SET role = 'qa_engineer' WHERE role = 'member';

-- Rename 'member' role to 'qa_engineer' in project_members
UPDATE project_members SET role = 'qa_engineer' WHERE role IN ('member', 'qa_member', 'viewer');

-- Rename 'member' role in pending invitations
UPDATE invitations SET role = 'qa_engineer' WHERE role IN ('member', 'qa_member', 'viewer');

CREATE INDEX IF NOT EXISTS idx_invitations_status     ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email  ON invitations(organization_id, email);
