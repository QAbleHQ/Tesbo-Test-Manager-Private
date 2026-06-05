ALTER TABLE ai_generation_requests
ADD COLUMN IF NOT EXISTS agent_name VARCHAR(128) NOT NULL DEFAULT 'Zyra the Edge Hunter',
ADD COLUMN IF NOT EXISTS task_status VARCHAR(32) NOT NULL DEFAULT 'in_review',
ADD COLUMN IF NOT EXISTS feedback TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS jira_issue_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS token_input INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_output INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_total INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_generation_requests_agent_status
ON ai_generation_requests(project_id, agent_name, task_status, created_at DESC);
