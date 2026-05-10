package main

import "testing"

func TestWebhookInterestedInEvent(t *testing.T) {
	if !webhookInterestedInEvent([]string{"task_executed"}, "task_executed") {
		t.Fatal("expected exact event match")
	}
	if !webhookInterestedInEvent([]string{"*"}, "approval_required") {
		t.Fatal("expected wildcard event match")
	}
	if webhookInterestedInEvent([]string{"task_status_changed"}, "task_executed") {
		t.Fatal("did not expect mismatched event to match")
	}
}

func TestSignWebhookPayloadDeterministic(t *testing.T) {
	got := signWebhookPayload("2026-05-10T12:00:00Z", []byte(`{"ok":true}`), "secret")
	want := "625197f9cc3e03462e8c31e2780b8d4225a87d60e7307c57458f918a567d9944"
	if got != want {
		t.Fatalf("unexpected signature: got %s want %s", got, want)
	}
}
