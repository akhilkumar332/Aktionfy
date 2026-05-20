-- migrations/032_add_locked_at.up.sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- Update the claim function to set locked_at
CREATE OR REPLACE FUNCTION fn_claim_due_tasks(batch_size INT, worker_id TEXT)
RETURNS SETOF tasks AS $$
DECLARE
    claimed_task tasks%ROWTYPE;
BEGIN
    FOR claimed_task IN
        WITH claimed AS (
            UPDATE tasks
            SET status = 'processing',
                locked_by = worker_id,
                locked_at = NOW()
            WHERE id IN (
                SELECT t.id 
                FROM tasks t
                LEFT JOIN tasks dep ON t.depends_on_task_id = dep.id
                WHERE t.next_run <= NOW() 
                  AND t.status = 'active'
                  AND (t.depends_on_task_id IS NULL OR (dep.user_id = t.user_id AND (dep.status = 'completed' OR dep.status = 'active')))
                ORDER BY t.next_run ASC
                LIMIT batch_size
                FOR UPDATE OF t SKIP LOCKED
            )
            RETURNING *
        )
        SELECT * FROM claimed
    LOOP
        PERFORM pg_notify(
            'task_claimed',
            json_build_object(
                'task_id', claimed_task.id::text,
                'user_id', claimed_task.user_id,
                'worker_id', worker_id
            )::text
        );
        RETURN NEXT claimed_task;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;
