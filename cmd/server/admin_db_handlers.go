package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// List tables
func apiAdminListTablesHandler(c echo.Context) error {
	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	query := `
		SELECT c.relname as table_name
		FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' 
		  AND c.relkind IN ('r', 'v', 'm', 'p')
		ORDER BY c.relkind, c.relname;
	`
	rows, err := dbPool.Query(c.Request().Context(), query)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to list tables: " + err.Error()})
	}
	defer rows.Close()

	var tables = make([]string, 0)
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err == nil {
			tables = append(tables, table)
		}
	}
	
	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to iterate tables: " + err.Error()})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: tables})
}

// Get table data
func apiAdminGetTableDataHandler(c echo.Context) error {
	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	tableName := c.Param("table_name")
	
	limitStr := c.QueryParam("limit")
	offsetStr := c.QueryParam("offset")
	
	limit := 50
	if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 500 {
		limit = parsed
	}
	
	offset := 0
	if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
		offset = parsed
	}

	ctx := c.Request().Context()
	
	// Safely quote the table name to prevent SQL injection while allowing any characters (e.g. hyphens)
	safeTableName := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))

	// Get total count
	var totalCount int64
	err := dbPool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", safeTableName)).Scan(&totalCount)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count rows: " + err.Error()})
	}

	// Get columns
	columnsQuery := `
		SELECT a.attname as column_name
		FROM pg_catalog.pg_attribute a
		JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
		JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
		WHERE n.nspname = 'public' 
		  AND c.relname = $1 
		  AND a.attnum > 0 
		  AND NOT a.attisdropped
		ORDER BY a.attnum;
	`
	colRows, err := dbPool.Query(ctx, columnsQuery, tableName)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to get columns: " + err.Error()})
	}
	defer colRows.Close()

	var columns = make([]string, 0)
	for colRows.Next() {
		var col string
		if err := colRows.Scan(&col); err == nil {
			columns = append(columns, col)
		}
	}
	colRows.Close()

	if err := colRows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to iterate columns: " + err.Error()})
	}

	if len(columns) == 0 {
		return c.JSON(http.StatusOK, APIResponse{
			Success: true,
			Data: map[string]interface{}{
				"columns": []string{},
				"rows":    []map[string]interface{}{},
				"total":   totalCount,
			},
		})
	}

	var quotedColumns = make([]string, 0)
	for _, col := range columns {
		quotedColumns = append(quotedColumns, fmt.Sprintf(`"%s"::text`, strings.ReplaceAll(col, `"`, `""`)))
	}

	dataQuery := fmt.Sprintf("SELECT %s FROM %s LIMIT %d OFFSET %d", strings.Join(quotedColumns, ", "), safeTableName, limit, offset)
	rows, err := dbPool.Query(ctx, dataQuery)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to query data: " + err.Error()})
	}
	defer rows.Close()

	var results = make([]map[string]interface{}, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read row values: " + err.Error()})
		}
		
		rowMap := make(map[string]interface{})
		for i, v := range values {
			if v == nil {
				rowMap[columns[i]] = nil
				continue
			}

			switch val := v.(type) {
			case [16]byte: // UUID
				rowMap[columns[i]] = fmt.Sprintf("%x-%x-%x-%x-%x", val[0:4], val[4:6], val[6:8], val[8:10], val[10:16])
			case time.Time:
				rowMap[columns[i]] = val.Format(time.RFC3339)
			case []byte:
				rowMap[columns[i]] = string(val)
			default:
				rowMap[columns[i]] = fmt.Sprintf("%v", val)
			}
		}
		results = append(results, rowMap)
	}

	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Error iterating rows: " + err.Error()})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"columns": columns,
			"rows":    results,
			"total":   totalCount,
		},
	})
}

// Execute query (read-only by default for safety, but can be dangerous)
type AdminQueryRequest struct {
	Query string `json:"query"`
}

func apiAdminExecuteQueryHandler(c echo.Context) error {
	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	var req AdminQueryRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request"})
	}

	if strings.TrimSpace(req.Query) == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Query cannot be empty"})
	}
	
	logQuery := req.Query
	if len(logQuery) > 100000 {
		runes := []rune(logQuery)
		if len(runes) > 100000 {
			logQuery = string(runes[:100000]) + "... (truncated)"
		}
	}

	// Ensure audit logging for custom queries
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       admin.ID,
		Action:       "admin.database_query",
		ResourceType: "database",
		Metadata: map[string]interface{}{
			"query": logQuery,
		},
	})

	ctx := c.Request().Context()
	
	// Execute query
	rows, err := dbPool.Query(ctx, req.Query)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: err.Error()})
	}
	defer rows.Close()

	fieldDescriptions := rows.FieldDescriptions()
	var columns = make([]string, 0)
	colNameCounts := make(map[string]int)

	for _, fd := range fieldDescriptions {
		name := string(fd.Name)
		originalName := name
		suffix := 1
		for {
			if _, exists := colNameCounts[name]; exists {
				name = fmt.Sprintf("%s_%d", originalName, suffix)
				suffix++
			} else {
				colNameCounts[name] = 1
				break
			}
		}
		columns = append(columns, name)
	}

	var results = make([]map[string]interface{}, 0)
	limitReached := false
	for rows.Next() {
		if len(results) >= 100 {
			limitReached = true
			break
		}
		
		values, err := rows.Values()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read row values: " + err.Error()})
		}
		
		rowMap := make(map[string]interface{})
		for i, v := range values {
			if v == nil {
				rowMap[columns[i]] = nil
				continue
			}

			switch val := v.(type) {
			case [16]byte: // UUID
				rowMap[columns[i]] = fmt.Sprintf("%x-%x-%x-%x-%x", val[0:4], val[4:6], val[6:8], val[8:10], val[10:16])
			case time.Time:
				rowMap[columns[i]] = val.Format(time.RFC3339)
			case []byte:
				rowMap[columns[i]] = string(val)
			default:
				rowMap[columns[i]] = fmt.Sprintf("%v", val)
			}
		}
		results = append(results, rowMap)
	}

	// Close rows explicitly to populate CommandTag correctly
	rows.Close()

	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Error iterating rows: " + err.Error()})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true, 
		Data: map[string]interface{}{
			"columns": columns,
			"rows": results,
			"rows_affected": rows.CommandTag().RowsAffected(),
			"command_tag": rows.CommandTag().String(),
			"limit_reached": limitReached,
		},
	})
}
