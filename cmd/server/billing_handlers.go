package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/checkout/session"
	"github.com/stripe/stripe-go/v78/webhook"
	"schedule-mcp/db"
)

func init() {
	stripe.Key = os.Getenv("STRIPE_API_KEY")
}

func apiCreateCheckoutSession(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	domain := os.Getenv("BASE_URL")
	if domain == "" {
		domain = "http://localhost:8080"
	}

	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(os.Getenv("STRIPE_PRO_PRICE_ID")),
				Quantity: stripe.Int64(1),
			},
		},
		ClientReferenceID: stripe.String(user.ID),
		SuccessURL:        stripe.String(domain + "/dashboard?payment=success"),
		CancelURL:         stripe.String(domain + "/dashboard?payment=cancel"),
	}

	s, err := session.New(params)
	if err != nil {
		log.Printf("Stripe session error: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create checkout session"})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    map[string]string{"url": s.URL},
	})
}

func apiStripeWebhook(c echo.Context) error {
	endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	payload, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	sig := c.Request().Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sig, endpointSecret)
	if err != nil {
		log.Printf("Webhook signature error: %v", err)
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid signature"})
	}

	if event.Type == "checkout.session.completed" {
		var session stripe.CheckoutSession
		err := json.Unmarshal(event.Data.Raw, &session)
		if err != nil {
			log.Printf("Error unmarshaling webhook data: %v", err)
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid data"})
		}

		userID := session.ClientReferenceID
		if userID != "" {
			log.Printf("Upgrading user %s to PRO tier", userID)
			err := queries.UpdateUserTier(c.Request().Context(), db.UpdateUserTierParams{
				Tier: pgtype.Text{String: TierPro, Valid: true},
				ID:   userID,
			})
			if err != nil {
				log.Printf("Failed to update user tier in DB: %v", err)
				return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Database error"})
			}
		}
	}

	return c.NoContent(http.StatusOK)
}
