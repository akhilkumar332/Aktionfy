#!/usr/bin/env node

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  CreateMessageRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Parse --api-key, --url
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

const BASE_URL = apiUrl || process.env.AKTIONFY_API_URL || "https://api.aktionfy.com";
const SSE_URL = new URL("/sse", BASE_URL);

async function main() {
  const sseTransport = new SSEClientTransport(SSE_URL, {
    requestInit: {
      headers: {
        "X-API-Key": apiKey
      }
    }
  });

  const mcpClient = new Client(
    { name: "aktionfy-bridge-client", version: "1.0.0" },
    { capabilities: { tools: {}, sampling: {}, prompts: {}, resources: {} } }
  );

  const mcpServer = new Server(
    { name: "aktionfy-bridge", version: "1.0.0" },
    { capabilities: { tools: {}, sampling: {}, prompts: {}, resources: {} } }
  );

  try {
    // 1. Connect to remote Aktionfy Server
    await mcpClient.connect(sseTransport);

    // 2. Setup Bridge Logic (Forwarding)
    
    // Tools
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return await mcpClient.listTools();
    });

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await mcpClient.callTool(request.params);
    });

    // Prompts (if any)
    mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      return await mcpClient.listPrompts();
    });

    mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return await mcpClient.getPrompt(request.params);
    });

    // Resources (if any)
    mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return await mcpClient.listResources();
    });

    mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return await mcpClient.readResource(request.params);
    });

    // Sampling (Backward forwarding: Server -> Bridge -> Host)
    mcpClient.setRequestHandler(CreateMessageRequestSchema, async (request) => {
      return await mcpServer.createMessage(request.params);
    });

    // 3. Connect to local Stdio host
    const stdioTransport = new StdioServerTransport();
    
    const cleanup = async () => {
        try { await sseTransport.close(); } catch (e) {}
        try { await stdioTransport.close(); } catch (e) {}
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    await mcpServer.connect(stdioTransport);

  } catch (error) {
    console.error("Failed to start Aktionfy Bridge:", error);
    process.exit(1);
  }
}

main();
