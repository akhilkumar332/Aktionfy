-- name: IncrementTemplateUses :one
UPDATE templates SET uses_count = uses_count + 1 WHERE id = $1 RETURNING uses_count;

-- name: ListUserTemplates :many
SELECT t.* FROM templates t 
WHERE t.workspace_id IN (
    SELECT w.id FROM workspaces w WHERE w.owner_id = $1
) OR t.is_public = true
ORDER BY t.created_at DESC;

-- name: UpdateTemplate :one
UPDATE templates SET name = COALESCE($1, name), description = COALESCE($2, description), config = COALESCE($3, config), is_public = COALESCE($4, is_public) WHERE templates.id = $5 AND templates.workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = $6
) RETURNING *;

-- name: DeleteTemplate :exec
DELETE FROM templates WHERE templates.id = $1 AND templates.workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = $2
);