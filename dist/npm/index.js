#!/usr/bin/env node

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Parse --api-key, --url, and --proxy (if any)
let apiKey = "";
let apiUrl = "";
for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--api-key" || args[i] === "-k") && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  } else if ((args[i] === "--url" || args[i] === "-u") && i + 1 < args.length) {
    apiUrl = args[i + 1];
    i++;
  }
}

if (!apiKey) {
  apiKey = process.env.AKTIONFY_API_KEY || process.env.X_API_KEY;
}

if (command === "install") {
  console.log("Aktionfy CLI: Installed successfully.");
  console.log("Note: Configuration should be handled by your MCP client (e.g., Claude Desktop, Cursor).");
  process.exit(0);
}

if (command !== "run" && command !== "start") {
  console.error("Usage: aktionfy <run|start> --api-key <YOUR_API_KEY> [--url <API_URL>]");
  process.exit(1);
}

if (!apiKey) {
  console.error("Error: --api-key is required to connect to the Aktionfy engine.");
  console.error("You can also set the AKTIONFY_API_KEY environment variable.");
  process.exit(1);
}

// Fallback to local for development if not specified
const BASE_URL = apiUrl || process.env.AKTIONFY_API_URL || "https://api.aktionfy.com";
const SSE_URL = new URL("/sse", BASE_URL);

async function main() {
  try {
    // 1. Set up the transport to the remote Aktionfy Server
    const sseTransport = new SSEClientTransport(SSE_URL, {
      requestInit: {
        headers: {
          "X-API-Key": apiKey
        }
      }
    });

    const mcpClient = new Client(
      {
        name: "aktionfy-proxy",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Connect to the remote server
    await mcpClient.connect(sseTransport);

    // 2. Set up the local stdio transport to communicate with the host client (e.g. Claude)
    const stdioTransport = new StdioServerTransport();
    
    // We need to pass messages back and forth. 
    stdioTransport.onmessage = async (message) => {
        // Forward message from Stdio (Claude) to SSE (Aktionfy Server)
        try {
            if (message.method === "tools/call") {
                 const result = await mcpClient.callTool({
                     name: message.params.name,
                     arguments: message.params.arguments
                 });
                 
                 stdioTransport.send({
                     jsonrpc: "2.0",
                     id: message.id,
                     result: result
                 });
            } else if (message.method === "tools/list") {
                const tools = await mcpClient.listTools();
                stdioTransport.send({
                     jsonrpc: "2.0",
                     id: message.id,
                     result: tools
                 });
            } else if (message.method === "ping") {
                 stdioTransport.send({
                     jsonrpc: "2.0",
                     id: message.id,
                     result: {}
                 });
            } else if (message.method === "initialize") {
                // Respond to initialize locally
                 stdioTransport.send({
                     jsonrpc: "2.0",
                     id: message.id,
                     result: {
                         protocolVersion: "2024-11-05",
                         capabilities: { tools: {} },
                         serverInfo: { name: "aktionfy-bridge", version: "1.0.0" }
                     }
                 });
            } else if (message.method === "notifications/initialized") {
                // Ignore
            }
            else {
                 if (message.id) {
                     stdioTransport.send({
                         jsonrpc: "2.0",
                         id: message.id,
                         error: { code: -32601, message: "Method not supported by this bridge" }
                     });
                 }
            }

        } catch (error) {
             if (message.id) {
                 stdioTransport.send({
                     jsonrpc: "2.0",
                     id: message.id,
                     error: { code: -32000, message: error.message }
                 });
             }
        }
    };

    const cleanup = async () => {
        try {
            await sseTransport.close();
        } catch (e) {}
        process.exit(0);
    };

    stdioTransport.onclose = cleanup;
    sseTransport.onclose = cleanup;
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Start listening on stdin
    await stdioTransport.start();

  } catch (error) {
    console.error("Failed to start Aktionfy Bridge:", error);
    process.exit(1);
  }
}

main();
