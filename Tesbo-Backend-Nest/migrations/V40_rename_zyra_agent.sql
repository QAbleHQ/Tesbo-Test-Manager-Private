ALTER TABLE ai_generation_requests
ALTER COLUMN agent_name SET DEFAULT 'Zyra the Test Generator';

UPDATE ai_generation_requests
SET agent_name = 'Zyra the Test Generator'
WHERE agent_name = 'Zyra the Edge Hunter';
