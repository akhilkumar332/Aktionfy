package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
	"schedule-mcp/db"
)

// RegisterUser hashes password, generates API key, and inserts user into DB
func RegisterUser(ctx context.Context, email, password string) (*User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	apiKeyBytes := make([]byte, 16)
	if _, err := rand.Read(apiKeyBytes); err != nil {
		return nil, fmt.Errorf("failed to generate api key: %w", err)
	}
	apiKey := hex.EncodeToString(apiKeyBytes)

	u, err := queries.CreateUser(ctx, db.CreateUserParams{
		Email:        pgtype.Text{String: email, Valid: true},
		PasswordHash: pgtype.Text{String: string(hashedPassword), Valid: true},
		ApiKey:       apiKey,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to insert user: %w", err)
	}

	return &User{
		ID:        u.ID,
		Email:     u.Email.String,
		APIKey:    u.ApiKey,
		Role:      u.Role.String,
		Tier:      u.Tier.String,
		CreatedAt: u.CreatedAt.Time,
	}, nil
}

// LoginUser verifies password and creates a session
func LoginUser(ctx context.Context, email, password string) (string, error) {
	info, err := queries.GetAuthInfoByEmail(ctx, pgtype.Text{String: email, Valid: true})
	if err != nil {
		return "", fmt.Errorf("invalid email or password")
	}

	err = bcrypt.CompareHashAndPassword([]byte(info.PasswordHash.String), []byte(password))
	if err != nil {
		return "", fmt.Errorf("invalid email or password")
	}

	sessionID, err := queries.CreateWebSession(ctx, db.CreateWebSessionParams{
		UserID:    pgtype.Text{String: info.ID, Valid: true},
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().UTC().Add(24 * time.Hour), Valid: true},
	})

	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	// sessionID is a UUID (pgtype.UUID)
	var idStr [36]byte
	hex.Encode(idStr[:8], sessionID.Bytes[:4])
	idStr[8] = '-'
	hex.Encode(idStr[9:13], sessionID.Bytes[4:6])
	idStr[13] = '-'
	hex.Encode(idStr[14:18], sessionID.Bytes[6:8])
	idStr[18] = '-'
	hex.Encode(idStr[19:23], sessionID.Bytes[8:10])
	idStr[23] = '-'
	hex.Encode(idStr[24:], sessionID.Bytes[10:])

	return string(idStr[:]), nil
}

// RotateAPIKey generates a new API key for the user and updates the DB
func RotateAPIKey(ctx context.Context, userID string) (string, error) {
	apiKeyBytes := make([]byte, 16)
	if _, err := rand.Read(apiKeyBytes); err != nil {
		return "", fmt.Errorf("failed to generate api key: %w", err)
	}
	newAPIKey := hex.EncodeToString(apiKeyBytes)

	err := queries.UpdateUserAPIKey(ctx, db.UpdateUserAPIKeyParams{
		ApiKey: newAPIKey,
		ID:     userID,
	})
	if err != nil {
		return "", fmt.Errorf("failed to update api key: %w", err)
	}

	return newAPIKey, nil
}
