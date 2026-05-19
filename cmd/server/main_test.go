package main

import (
	"os"
	"testing"

	"aktionfy/db"
)

func TestMain(m *testing.M) {
	mock := &mockDB{}
	queries = db.New(mock)
	dbPool = mock
	os.Exit(m.Run())
}
