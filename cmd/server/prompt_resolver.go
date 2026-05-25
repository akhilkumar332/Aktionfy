package main

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"

	"time"
	"aktionfy/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var secretRegex = regexp.MustCompile(`\{\{secrets\.([a-zA-Z0-9_-]+)\}\}`)
var envVarRegex = regexp.MustCompile(`\{\{env\.([a-zA-Z0-9_-]+)\}\}`)
var webhookBodyRegex = regexp.MustCompile(`\{\{webhook\.body\.([a-zA-Z0-9._-]+)\}\}`)
var stateRegex = regexp.MustCompile(`\{\{state\.([a-zA-Z0-9._-]+)\}\}`)
var builtinRegex = regexp.MustCompile(`\{\{(now|today|uuid)\}\}`)

func resolveDotNotation(m map[string]interface{}, path string) (interface{}, bool) {
	parts := regexp.MustCompile(`\.`).Split(path, -1)
	var current interface{} = m
	for _, part := range parts {
		if curMap, ok := current.(map[string]interface{}); ok {
			if next, exists := curMap[part]; exists {
				current = next
			} else {
				return nil, false
			}
		} else {
			return nil, false
		}
	}
	return current, true
}

func resolvePrompt(ctx context.Context, userID string, taskID pgtype.UUID, executionID string, rawPrompt string, parentTaskID pgtype.UUID, triggerPayload map[string]interface{}) (string, int, bool, error) {
	resolved := rawPrompt
	resolvedSecrets := make(map[string]string)
	secretCount := 0

	// 1. Resolve Secrets: {{secrets.NAME}}
	// Find all unique secret names first
	matches := secretRegex.FindAllStringSubmatch(resolved, -1)
	if len(matches) > 0 {
		uniqueNames := make(map[string]bool)
		for _, m := range matches {
			if len(m) >= 2 && !uniqueNames[m[1]] {
				uniqueNames[m[1]] = true
			}
		}

		// Bulk fetch (fallback to iterative if bulk query doesn't exist, but we have GetUserSecret)
		// For elite optimization, we use iterative but cached results to avoid redundant DB hits for same key
		resolved = secretRegex.ReplaceAllStringFunc(resolved, func(match string) string {
			submatches := secretRegex.FindStringSubmatch(match)
			if len(submatches) < 2 {
				return match
			}
			secretName := submatches[1]

			if val, ok := resolvedSecrets[secretName]; ok {
				return val
			}

			if RedisClient != nil {
				allLeasesKey := fmt.Sprintf("secret:lease:all:%s", userID)
				isLeased, err := RedisClient.SIsMember(ctx, allLeasesKey, secretName).Result()
				if err == nil && isLeased {
					leaseKey := fmt.Sprintf("secret:lease:has:%s:%s", userID, secretName)
					exists, err := RedisClient.Exists(ctx, leaseKey).Result()
					if err == nil && exists == 0 {
						_ = queries.DeleteUserSecret(ctx, db.DeleteUserSecretParams{
							UserID: userID,
							Name:   secretName,
						})
						_ = RedisClient.SRem(ctx, allLeasesKey, secretName).Err()
						val := fmt.Sprintf("[SECRET %s EXPIRED]", secretName)
						resolvedSecrets[secretName] = val
						return val
					}
				}
			}

			encryptedVal, err := queries.GetUserSecret(ctx, db.GetUserSecretParams{
				UserID: userID,
				Name:   secretName,
			})
			if err != nil {
				val := fmt.Sprintf("[SECRET %s NOT FOUND]", secretName)
				resolvedSecrets[secretName] = val
				return val
			}

			decryptedVal, err := Decrypt(encryptedVal)
			if err != nil {
				val := "[DECRYPTION ERROR]"
				resolvedSecrets[secretName] = val
				return val
			}

			val := string(decryptedVal)
			resolvedSecrets[secretName] = val
			secretCount++
			return val
		})
	}

	// 2. Resolve Environment Variables: {{env.KEY}}
	envVars, err := queries.GetTaskWorkspaceEnvVars(ctx, taskID)
	if err == nil {
		envMap := make(map[string]string)
		for _, ev := range envVars {
			envMap[ev.Name] = ev.Value
		}

		resolved = envVarRegex.ReplaceAllStringFunc(resolved, func(match string) string {
			submatches := envVarRegex.FindStringSubmatch(match)
			if len(submatches) < 2 {
				return match
			}
			key := submatches[1]
			if val, ok := envMap[key]; ok {
				return val
			}
			return match
		})
	}

	// 3. Resolve Webhook Body Variables: {{webhook.body.FIELD}}
	if triggerPayload != nil {
		resolved = webhookBodyRegex.ReplaceAllStringFunc(resolved, func(match string) string {
			submatches := webhookBodyRegex.FindStringSubmatch(match)
			if len(submatches) < 2 {
				return match
			}
			key := submatches[1]
			if val, ok := resolveDotNotation(triggerPayload, key); ok {
				if strVal, isStr := val.(string); isStr {
					return strVal
				}
				jsonVal, _ := json.Marshal(val)
				return string(jsonVal)
			}
			return match
		})
	}

	// 4. Resolve Workflow State: {{state.VARIABLE}}
	stateBytes, err := queries.GetWorkflowState(ctx, db.GetWorkflowStateParams{
		TaskID:      taskID,
		ExecutionID: executionID,
	})
	if err == nil {
		var stateMap map[string]interface{}
		if err := json.Unmarshal(stateBytes, &stateMap); err == nil {
			resolved = stateRegex.ReplaceAllStringFunc(resolved, func(match string) string {
				submatches := stateRegex.FindStringSubmatch(match)
				if len(submatches) < 2 {
					return match
				}
				key := submatches[1]
				if val, ok := resolveDotNotation(stateMap, key); ok {
					if strVal, isStr := val.(string); isStr {
						return strVal
					}
					jsonVal, _ := json.Marshal(val)
					return string(jsonVal)
				}
				return match
			})
		}
	}

	// 4.5 Resolve Built-in Variables: {{now}}, {{today}}, {{uuid}}
	resolved = builtinRegex.ReplaceAllStringFunc(resolved, func(match string) string {
		submatches := builtinRegex.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		key := submatches[1]
		switch key {
		case "now":
			return time.Now().UTC().Format(time.RFC3339)
		case "today":
			return time.Now().UTC().Format("2006-01-02")
		case "uuid":
			u := uuid.New()
			return u.String()
		}
		return match
	})

	chained := false
	// 5. Resolve Chaining Context
	if parentTaskID.Valid {
		parentOutput, err := queries.GetLatestTaskLogResponse(ctx, db.GetLatestTaskLogResponseParams{
			TaskID: parentTaskID,
			UserID: userID,
		})
		if err == nil && parentOutput.Valid && parentOutput.String != "" {
			// Prepend context
			resolved = fmt.Sprintf("Context from previous task:\n%s\n\nYour Prompt:\n%s", parentOutput.String, resolved)
			chained = true
		}
	}

	return resolved, secretCount, chained, nil
}
