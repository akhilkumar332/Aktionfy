# Design Spec: SSE Hook with Simple Reconnect

## Overview
Implement a reusable React hook `useSSE` to consume Server-Sent Events (SSE) from the backend `/sse` endpoint.

## Requirements
- Consume events from `/sse` using `EventSource`.
- Handle JSON parsing of event data.
- Implement automatic reconnection with a 3-second delay on error.
- Ensure proper cleanup of connections and timeouts.

## Implementation Details
- **Path:** `frontend/src/hooks/useSSE.js`
- **Hook API:** `useSSE(onEvent)`
- **State/Refs:** Use `useEffect` to manage the lifecycle.
- **Error Handling:**
  - Log errors to console.
  - Close the `EventSource` on error.
  - Use `setTimeout` to trigger a re-render or re-run the effect to reconnect after 3 seconds.

## Verification
- Verify that the connection is established.
- Verify that events are received and parsed.
- Verify that the hook attempts to reconnect if the server goes down.
