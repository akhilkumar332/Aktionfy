package main

import (
	"aktionfy/db"
	"testing"
)

func TestListUserTasksResultFields(t *testing.T) {
	// This is a compile-time check mostly, but also verifies we can access the fields.
	var row db.ListUserTasksRow
	_ = row.AgentPrompt
	_ = row.VersionCount
}
