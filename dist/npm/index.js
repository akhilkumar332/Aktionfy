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

// Parse advanced options
let apiKey = "";
let apiUrl = "";
let preventSleep = false;
let aiProvider = "openai";
let aiModel = "";

for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--api-key" || args[i] === "-k") && i + 1 < args.length) {
    apiKey = args[i + 1];
    i++;
  } else if ((args[i] === "--url" || args[i] === "-u") && i + 1 < args.length) {
    apiUrl = args[i + 1];
    i++;
  } else if (args[i] === "--prevent-sleep") {
    preventSleep = true;
  } else if (args[i] === "--ai-provider") {
    aiProvider = args[i + 1]?.toLowerCase() || "openai";
    i++;
  } else if (args[i] === "--ai-model") {
    aiModel = args[i + 1];
    i++;
  }
}

if (preventSleep) {
  try {
    // Simple stay-awake logic (prevent process from idling out)
    const interval = setInterval(() => {}, 1000 * 60 * 60);
    console.log("Aktionfy CLI: Sleep prevention active.");
  } catch (e) {
    console.warn("Aktionfy CLI: Could not activate sleep prevention.");
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
      try {
        // 1. Try to forward to the connected host (e.g. Claude Desktop)
        return await mcpServer.createMessage(request.params);
      } catch (error) {
        // 2. Fallback to local LLM if host is not responding or not connected
        console.log(`Aktionfy CLI: Executing sampling request via ${aiProvider}...`);
        
        switch (aiProvider) {
          case "anthropic":
            return await executeAnthropic(request);
          case "google":
          case "gemini":
            return await executeGemini(request);
          default:
            return await executeOpenAI(request);
        }
      }
    });

    async function executeOpenAI(request) {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error("OPENAI_API_KEY not set for standalone execution.");
        
        const messages = request.params.messages.map(m => ({
          role: m.role,
          content: m.content.text || m.content
        }));

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: aiModel || request.params.modelPreferences?.hints?.[0]?.name || "gpt-4o",
            messages: messages,
            max_tokens: request.params.maxTokens || 1000
          })
        });

        if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`);
        const data = await response.json();
        return {
          role: "assistant",
          content: { type: "text", text: data.choices[0].message.content },
          model: data.model,
          stopReason: data.choices[0].finish_reason === "stop" ? "endTurn" : "maxTokens"
        };
    }

    async function executeAnthropic(request) {
        const { Anthropic } = require("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const response = await client.messages.create({
          model: aiModel || "claude-3-5-sonnet-20240620",
          max_tokens: request.params.maxTokens || 1000,
          messages: request.params.messages.map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content.text || m.content
          }))
        });

        return {
          role: "assistant",
          content: { type: "text", text: response.content[0].text },
          model: response.model,
          stopReason: response.stop_reason === "end_turn" ? "endTurn" : "maxTokens"
        };
    }

    async function executeGemini(request) {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: aiModel || "gemini-1.5-pro" });

        const history = request.params.messages.slice(0, -1).map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content.text || m.content }]
        }));
        
        const lastMsg = request.params.messages[request.params.messages.length - 1];
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMsg.content.text || lastMsg.content);
        const response = await result.response;

        return {
          role: "assistant",
          content: { type: "text", text: response.text() },
          model: aiModel || "gemini-1.5-pro",
          stopReason: "endTurn"
        };
    }

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
