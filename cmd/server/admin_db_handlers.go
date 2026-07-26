package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// List tables
func apiAdminListTablesHandler(c echo.Context) error {
	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	query := `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public'
		ORDER BY table_type, table_name;
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

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: tables})
}

// Get table data
func apiAdminGetTableDataHandler(c echo.Context) error {
	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	tableName := c.Param("table_name")
	
	// Basic sanitization for table name (only alphanumeric and underscores)
	for _, char := range tableName {
		if !(char >= 'a' && char <= 'z') && !(char >= 'A' && char <= 'Z') && !(char >= '0' && char <= '9') && char != '_' {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid table name"})
		}
	}

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
	
	// Get total count
	var totalCount int64
	err := dbPool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", tableName)).Scan(&totalCount)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count rows: " + err.Error()})
	}

	// Get columns
	columnsQuery := `
		SELECT column_name 
		FROM information_schema.columns 
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position;
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

	if len(columns) == 0 {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Table not found or has no columns"})
	}

	var quotedColumns = make([]string, 0)
	for _, col := range columns {
		quotedColumns = append(quotedColumns, fmt.Sprintf(`"%s"`, col))
	}

	// Get rows using string formatting to force simple query protocol and guarantee text return values
	dataQuery := fmt.Sprintf("SELECT %s FROM \"%s\" LIMIT %d OFFSET %d", strings.Join(quotedColumns, ", "), tableName, limit, offset)
	rows, err := dbPool.Query(ctx, dataQuery)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to query data: " + err.Error()})
	}
	defer rows.Close()

	var results = make([]map[string]interface{}, 0)
	for rows.Next() {
		values := rows.RawValues()
		rowMap := make(map[string]interface{})
		for i, v := range values {
			if v == nil {
				rowMap[columns[i]] = nil
			} else {
				rowMap[columns[i]] = string(v) // Return raw strings for all data to avoid type issues
			}
		}
		results = append(results, rowMap)
	}
	
	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Error iterating rows: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
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
	
	// Ensure audit logging for custom queries
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       admin.ID,
		Action:       "admin.database_query",
		ResourceType: "database",
		Metadata: map[string]interface{}{
			"query": req.Query,
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
		if count, exists := colNameCounts[name]; exists {
			colNameCounts[name] = count + 1
			name = fmt.Sprintf("%s_%d", name, count)
		} else {
			colNameCounts[name] = 1
		}
		columns = append(columns, name)
	}

	var results = make([]map[string]interface{}, 0)
	for rows.Next() {
		values := rows.RawValues()
		rowMap := make(map[string]interface{})
		for i, v := range values {
			if v == nil {
				rowMap[columns[i]] = nil
			} else {
				rowMap[columns[i]] = string(v)
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
			"rows": results,
			"rows_affected": rows.CommandTag().RowsAffected(),
		},
	})
}
