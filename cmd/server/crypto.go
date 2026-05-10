package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"os"
)

var encryptionKey []byte

func initCrypto() {
	keyHex := os.Getenv("ENCRYPTION_KEY")
	if keyHex == "" {
		// If ENCRYPTION_KEY is not provided, log a critical error and exit.
		// In a production environment, this key must be set.
		// For local development, a specific test key or a different mechanism might be used,
		// but a zero-filled key is insecure and should not be used for any real data.
		log.Fatal("CRITICAL: ENCRYPTION_KEY environment variable is not set. Cannot initialize crypto securely.")
		// The code below will not be reached if log.Fatal is called.
		// encryptionKey = make([]byte, 32) // This fallback is removed.
		return
	}
	key, err := hex.DecodeString(keyHex)
	if err != nil || len(key) != 32 {
		log.Fatalf("Invalid ENCRYPTION_KEY: %v (must be 64-character hex string for 32 bytes)", err)
	}
	encryptionKey = key
}

func Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func Decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
