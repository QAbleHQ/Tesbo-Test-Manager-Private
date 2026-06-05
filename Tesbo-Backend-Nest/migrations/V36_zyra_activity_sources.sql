ALTER TABLE ai_generation_requests
ADD COLUMN IF NOT EXISTS source_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS activity_log JSONB NOT NULL DEFAULT '[]'::jsonb;
