package main

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockDB struct{}

func (m *mockDB) Exec(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

func (m *mockDB) Query(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error) {
	return &mockRows{}, nil
}

func (m *mockDB) QueryRow(ctx context.Context, query string, args ...interface{}) pgx.Row {
	return &mockRow{}
}

func (m *mockDB) Begin(ctx context.Context) (pgx.Tx, error) {
	return &mockTx{}, nil
}

func (m *mockDB) Ping(ctx context.Context) error {
	return nil
}

func (m *mockDB) Close() {}

type mockTx struct {
	pgx.Tx
}

func (m *mockTx) Begin(ctx context.Context) (pgx.Tx, error) { return m, nil }
func (m *mockTx) Commit(ctx context.Context) error         { return nil }
func (m *mockTx) Rollback(ctx context.Context) error       { return nil }
func (m *mockTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (m *mockTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (m *mockTx) LargeObjects() pgx.LargeObjects                { return pgx.LargeObjects{} }
func (m *mockTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (m *mockTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return &mockRows{}, nil
}
func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return &mockRow{}
}
func (m *mockTx) Conn() *pgx.Conn { return nil }

type mockRows struct {
	pgx.Rows
}

func (m *mockRows) Close()     {}
func (m *mockRows) Next() bool { return false }
func (m *mockRows) Err() error { return nil }
func (m *mockRows) Scan(dest ...interface{}) error { return nil }

type mockRow struct {
	pgx.Row
}

func (m *mockRow) Scan(dest ...interface{}) error { return nil }
