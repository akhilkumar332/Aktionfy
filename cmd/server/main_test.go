package main

import (
	"os"
	"testing"

	"aktionfy/db"
)

func TestMain(m *testing.M) {
	queries = db.New(&mockDB{})
	os.Exit(m.Run())
}
