-- Reverse of migrations/008_task_claim_notify.up.sql

CREATE OR REPLACE FUNCTION fn_claim_due_tasks(batch_size INT, worker_id TEXT)
RETURNS SETOF tasks AS $$
DECLARE
    claimed_task tasks%ROWTYPE;
BEGIN
    FOR claimed_task IN
        WITH claimed AS (
            UPDATE tasks
            SET status = 'processing', -- Temporary state to prevent double-firing
                locked_by = worker_id
            WHERE id IN (
                SELECT t.id 
                FROM tasks t
                -- Ensure dependency belongs to same user AND is in a valid state
                LEFT JOIN tasks dep ON t.depends_on_task_id = dep.id
                WHERE t.next_run <= NOW() 
                  AND t.status = 'active'
                  -- Ensure dependency belongs to same user AND is in a valid state
                  AND (t.depends_on_task_id IS NULL OR (dep.user_id = t.user_id AND (dep.status = 'completed' OR dep.status = 'active')))
                ORDER BY t.next_run ASC
                LIMIT batch_size
                FOR UPDATE OF t SKIP LOCKED -- CRITICAL: Prevents race conditions
            )
            RETURNING *
        )
        SELECT * FROM claimed
    LOOP
        RETURN NEXT claimed_task;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;
