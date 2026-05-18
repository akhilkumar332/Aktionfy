
import { Terminal, Shield, Zap, Globe, Layers, Settings, Database, Code, History } from 'lucide-react';

const Overview = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Overview</h1>
        <p className="text-xl text-zinc-300 font-medium text-balance">Aktionfy is a production-grade orchestration engine that brings persistence and reliability to the Model Context Protocol ecosystem.</p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">The Persistence Gap</h2>
        <p>
          Standard MCP implementations are inherently transient. Tools only exist while a session is active, 
          and there is no native way to trigger actions based on wall-clock time. If your LLM needs to 
          "remember" to perform a task in 4 hours, or every Monday at 9 AM, standard MCP fails.
        </p>
        <p className="mt-4 font-bold">Aktionfy fills this gap by providing:</p>
        <ul className="list-disc pl-6 space-y-2 mt-4 text-zinc-300">
          <li><strong>Autonomous Pipelines:</strong> Sequential task chaining where completion triggers the next action.</li>
          <li><strong>Secure Persistence:</strong> AES-256-GCM encrypted Global Secret Vault for centralized API key management.</li>
          <li><strong>Prompt Injection:</strong> Dynamic resolution of <code>{`{{secrets.NAME}}`}</code> and parent context injection.</li>
          <li><strong>Human-in-the-Loop:</strong> Real-time approval workflows for sensitive automated actions.</li>
          <li><strong>Durable State:</strong> Tasks survive server restarts and client disconnections.</li>
          <li><strong>Live Telemetry:</strong> Real-time status updates and log streaming powered by Redis.</li>
        </ul>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
        <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm">
          <Database className="text-brand-primary mb-4" size={32} />
          <h3 className="font-bold text-xl text-brand-primary mb-2">Linear Scalability</h3>
          <p className="text-zinc-300 text-sm">Distributed orchestration via Redis Pub/Sub ensures performance remains constant across nodes.</p>
        </div>
        <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm">
          <Layers className="text-brand-primary mb-4" size={32} />
          <h3 className="font-bold text-xl text-brand-primary mb-2">Agentic Chaining</h3>
          <p className="text-zinc-300 text-sm">Link tasks together to build complex, self-executing AI multi-step workflows.</p>
        </div>
      </div>
    </div>
  </>
);

const QuickStart = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Quick Start</h1>
        <p className="text-xl text-zinc-300 font-medium">Get your first persistent AI task running in under 5 minutes.</p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">1. Create an Account</h2>
        <p>Head over to the <a href="/signup">Sign Up</a> page. Every new account starts on the <strong>Free Tier</strong>, allowing up to 2 concurrent active tasks.</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">2. Connect your Client</h2>
        <p className="mb-4">Install the global CLI client using <code>npx</code> and copy your API key from the Dashboard:</p>
        <div className="space-y-4">
          <pre className="p-6 rounded-2xl bg-zinc-900/50 text-emerald-400 font-mono text-sm shadow-xl">
            $ npx @aktionfy/mcp install --api-key YOUR_KEY
          </pre>
          <p className="text-sm text-zinc-300 italic">Alternatively, manually configure your <code>mcp_config.json</code>:</p>
          <pre className="p-6 rounded-2xl bg-zinc-900/50 text-emerald-400 font-mono text-sm shadow-xl">
{`{
  "mcpServers": {
    "schedule": {
      "command": "aktionfy",
      "args": ["run"],
      "env": { "X-API-KEY": "YOUR_KEY" }
    }
  }
}`}
          </pre>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">3. Schedule a Task</h2>
        <p>Use your LLM (Claude/Cursor) to create a task via the <code>create_task</code> tool:</p>
        <div className="bg-zinc-900 p-6 rounded-2xl font-medium border border-zinc-800">
          "Create a task named 'Check News' that runs every hour at minute 0 using cron '0 * * * *' and asks me 'What's happening in AI today?'"
        </div>
      </section>
    </div>
  </>
);

const InstallationDocs = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Installation</h1>
        <p className="text-xl text-zinc-300 font-medium text-balance">Comprehensive guide for deploying Aktionfy in your own environment.</p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-3">
          <Terminal size={24} className="text-brand-primary" /> Client-Side (Global Installer)
        </h2>
        <p className="mb-6">The fastest way to install the Aktionfy client on any machine with Node.js installed.</p>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 rounded-xl font-mono text-sm">
            $ npx @aktionfy/mcp install
          </div>
          <p className="text-sm text-zinc-300">For non-NPM environments, use the standard shell installer:</p>
          <div className="p-4 bg-zinc-900 rounded-xl font-mono text-sm">
            $ curl -sL https://github.com/akhilkumar332/aktionfy/install.sh | bash
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-3">
          <Globe size={24} className="text-blue-500" /> Self-Hosted Server (Docker)
        </h2>
        <p className="mb-6">Deploy your own private Aktionfy server using Docker Compose.</p>
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 rounded-xl font-mono text-sm">
            $ git clone https://github.com/akhilkumar332/aktionfy.git
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl font-mono text-sm">
            $ cd aktionfy && docker-compose up -d
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm not-prose">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings size={20} className="text-zinc-300" /> Environment Configuration
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800/50 text-zinc-300 uppercase tracking-widest text-[10px]">
                <th className="py-3 px-2">Variable</th>
                <th className="py-3 px-2">Default</th>
                <th className="py-3 px-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              <tr>
                <td className="py-3 px-2 font-mono text-brand-primary">DATABASE_URL</td>
                <td className="py-3 px-2 text-zinc-300 italic">required</td>
                <td className="py-3 px-2 text-zinc-300">PostgreSQL connection string</td>
              </tr>
              <tr>
                <td className="py-3 px-2 font-mono text-brand-primary">REDIS_URL</td>
                <td className="py-3 px-2 font-mono">localhost:6379</td>
                <td className="py-3 px-2 text-zinc-300">Redis orchestration and Pub/Sub</td>
              </tr>
              <tr>
                <td className="py-3 px-2 font-mono text-brand-primary">ENCRYPTION_KEY</td>
                <td className="py-3 px-2 text-zinc-300 italic">required</td>
                <td className="py-3 px-2 text-zinc-300">64-character hex key for AES-256-GCM</td>
              </tr>
              <tr>
                <td className="py-3 px-2 font-mono text-brand-primary">STRIPE_API_KEY</td>
                <td className="py-3 px-2 text-zinc-300 italic">optional</td>
                <td className="py-3 px-2 text-zinc-300">Secret key for billing integration</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>
);

const CoreConcepts = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Core Concepts</h1>
        <p className="text-xl text-zinc-300 font-medium">Understand the mental model behind our scheduling engine.</p>
      </header>

      <div className="space-y-10">
        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-colors duration-500">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">The Sampling Bridge</h3>
            <p className="text-zinc-300 leading-relaxed">
              Execution doesn't happen on our server. Instead, we use a **Pub/Sub bridge** to notify your 
              physical client session that a task is due. Your client then "samples" the LLM and 
              returns the output to us for logging and further scheduling.
            </p>
          </div>
        </div>

        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
            <History size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">Immutable Versioning</h3>
            <p className="text-zinc-300 leading-relaxed">
              Every time you update a task's prompt or configuration, the system automatically creates 
              an immutable snapshot. This allows you to view history and perform **one-click rollbacks** 
              if a prompt modification leads to unexpected AI behavior.
            </p>
          </div>
        </div>

        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500">
            <Globe size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">Workspace Environment</h3>
            <p className="text-zinc-300 leading-relaxed">
              Isolate configurations using Workspaces. You can define environment variables at the 
              workspace level and inject them into any task prompt using the <code>{`{{env.KEY}}`}</code> 
              syntax, enabling seamless switching between dev, staging, and production contexts.
            </p>
          </div>
        </div>

        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
            <Layers size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">Sequential Pipelines</h3>
            <p className="text-zinc-300 leading-relaxed">
              Tasks can be chained together. When a parent task finishes, any dependent tasks flagged with 
              <code>trigger_on_completion</code> are fired immediately. The parent task's LLM output is 
              automatically injected into the child task's context, enabling complex multi-step workflows.
            </p>
          </div>
        </div>

        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">Secure Injection</h3>
            <p className="text-zinc-300 leading-relaxed">
              Our <strong>Prompt Resolver</strong> securely handles credentials. When a task runs, any 
              <code>{`{{secrets.NAME}}`}</code> tags in your prompt are replaced with decrypted values 
              from the vault. This happens in-memory just milliseconds before the physical LLM call.
            </p>
          </div>
        </div>

        <div className="flex gap-8 group">
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-colors duration-500">
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-zinc-100 mb-2">Transactional Locking</h3>
            <p className="text-zinc-300 leading-relaxed">
              We use <code>FOR UPDATE SKIP LOCKED</code> at the database level. This allows multiple 
              parallel worker nodes to safely "claim" due tasks without ever double-triggering an 
              action, providing industry-standard consistency.
            </p>
          </div>
        </div>
      </div>
    </div>
  </>
);

const ApiReference = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">API Reference</h1>
        <p className="text-xl text-zinc-300 font-medium text-balance">Technical documentation for the REST API and MCP Tools.</p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-3">
          <Code size={24} className="text-brand-primary" /> MCP Tools
        </h2>
        <div className="space-y-6">
          <div className="border border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm bg-zinc-900">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="font-mono font-bold text-zinc-100">create_task</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Core Tool</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-300">Creates a new durable schedule entry.</p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-300">Arguments</p>
                  <p className="font-mono text-zinc-300">name, trigger_type, agent_prompt, secrets (optional), requires_approval (bool)</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="font-bold text-zinc-300">Trigger Types</p>
                  <p className="font-mono text-zinc-300">interval, cron, date</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm bg-zinc-900">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="font-mono font-bold text-zinc-100">store_secret</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">V3 Tool</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-300">Encrypts and stores a sensitive value in the Global Secret Vault.</p>
            </div>
          </div>

          <div className="border border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm bg-zinc-900">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="font-mono font-bold text-zinc-100">list_secrets</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">V3 Tool</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-300">Returns a Markdown table of names of stored secrets (never exposes values).</p>
            </div>
          </div>

          <div className="border border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm bg-zinc-900">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="font-mono font-bold text-zinc-100">list_tasks</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Core Tool</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-300">Returns a beautiful Markdown table and raw JSON of all active and paused tasks.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-3">
          <Globe size={24} className="text-blue-500" /> Outbound Webhooks
        </h2>
        <p className="mb-6">Integrate Aktionfy with your external systems via event-driven callbacks.</p>
        <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800/50 space-y-4">
           <h4 className="font-bold text-zinc-100">Supported Events</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                 <p className="font-mono text-xs font-bold text-brand-primary">task_executed</p>
                 <p className="text-[11px] text-zinc-300">Fires when a task completes successfully with LLM output.</p>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                 <p className="font-mono text-xs font-bold text-red-500">task_failed</p>
                 <p className="text-[11px] text-zinc-300">Fires when a task exceeds max retries or errors out.</p>
              </div>
           </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">REST Endpoints</h2>
        <div className="bg-zinc-900/50 p-6 rounded-2xl space-y-4 font-mono text-xs">
          <div className="flex gap-4">
            <span className="text-brand-primary font-bold w-12">GET</span>
            <span className="text-zinc-300">/api/v1/dashboard</span>
            <span className="text-zinc-300 ml-auto">Retrieve account stats</span>
          </div>
          <div className="flex gap-4 border-t border-zinc-800/50 pt-4">
            <span className="text-emerald-400 font-bold w-12">POST</span>
            <span className="text-zinc-300">/api/auth/login</span>
            <span className="text-zinc-300 ml-auto">Initiate browser session</span>
          </div>
        </div>
      </section>
    </div>
  </>
);

const WorkerArchitecture = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Worker Architecture</h1>
        <p className="text-xl text-zinc-300 font-medium">Inside the distributed execution engine.</p>
      </header>

      <section className="bg-zinc-900 p-10 rounded-3xl border border-zinc-800 shadow-sm relative overflow-hidden not-prose">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -translate-x-[-20%] -translate-y-[20%] blur-2xl"></div>
        <h2 className="text-2xl font-bold mb-8">The Lifecycle of a Task</h2>
        <div className="space-y-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-8 h-8 rounded-full bg-zinc-900/50 text-white flex items-center justify-center font-bold">1</div>
            <div className="h-px flex-1 bg-zinc-900"></div>
            <div className="text-sm font-bold text-zinc-300">Claimed via SQL Lock</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-8 h-8 rounded-full bg-zinc-900/50 text-white flex items-center justify-center font-bold">2</div>
            <div className="h-px flex-1 bg-zinc-900"></div>
            <div className="text-sm font-bold text-zinc-300">Published to Redis Pub/Sub</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold">3</div>
            <div className="h-px flex-1 bg-zinc-900"></div>
            <div className="text-sm font-bold text-brand-primary">Execution Node Triggers SSE</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-8 h-8 rounded-full bg-zinc-900/50 text-white flex items-center justify-center font-bold">4</div>
            <div className="h-px flex-1 bg-zinc-900"></div>
            <div className="text-sm font-bold text-zinc-300">Result Logged & Re-scheduled</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">The Reaper Process</h2>
        <p>
          To ensure reliability, a separate <strong>Reaper</strong> process runs every 1 minute. 
          It scans the database for tasks that have been in the "processing" state for more than 5 minutes 
          (indicating a worker node failure) and resets them back to "active" for another node to pick up.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">Worker Heartbeats</h2>
        <p>
          Each execution node maintains a persistent heartbeat. Every 30 seconds, the node updates its 
          status in the central registry. If a node fails to heartbeat for more than 2 minutes, the 
          system automatically flags it as offline and reassigns its pending workload.
        </p>
      </section>
    </div>
  </>
);

const ProtocolSpecDoc = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Protocol Specification</h1>
        <p className="text-xl text-zinc-300 font-medium">Deep technical details on the Aktionfy implementation of the protocol.</p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">The SSE Transport</h2>
        <p>
          We implement the **SSE Transport** as defined in the MCP base spec, but with a persistent connection model. 
          Every client connection is assigned a unique internal ID and mapped to a User in Redis.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">Remote Sampling (createMessage)</h2>
        <p>
          This is our core innovation. When the server decides a task is due, it crafts a <code>sampling/createMessage</code> 
          JSON-RPC notification.
        </p>
        <pre className="p-6 rounded-2xl bg-zinc-900/50 text-emerald-400 font-mono text-sm overflow-x-auto">
{`{
  "jsonrpc": "2.0",
  "method": "sampling/createMessage",
  "params": {
    "messages": [{ "role": "user", "content": { "type": "text", "text": "..." } }],
    "maxTokens": 1000
  }
}`}
        </pre>
      </section>
    </div>
  </>
);

const SecurityDocs = () => (
  <>
    <div className="space-y-12">
      <header>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4 tracking-tighter">Auth & Security</h1>
        <p className="text-xl text-zinc-300 font-medium">How we protect your credentials and AI tasks.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 not-prose">
        <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm">
          <Shield size={32} className="text-emerald-500 mb-4" />
          <h3 className="font-bold text-xl mb-2">Zero-Trust Vault</h3>
          <p className="text-zinc-300 text-sm">Task secrets are encrypted using AES-256-GCM at rest. We never store plain-text credentials; they are decrypted only in-memory during task execution.</p>
        </div>
        <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm">
          <Zap size={32} className="text-amber-500 mb-4" />
          <h3 className="font-bold text-xl mb-2">CSRF Protection</h3>
          <p className="text-zinc-300 text-sm">Every mutation request is protected by double-submit cookie tokens and strictly validated Origins, mitigating cross-site scripting risks.</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-zinc-100 mb-4">Identity & Session Isolation</h2>
        <p>
          We use **Database-backed Sessions** instead of simple JWTs. This allows for instant session revocation 
          (e.g., when a user logs out or rotates an API key). Session cookies are set with <code>HttpOnly</code>, 
          <code>Secure</code>, and <code>SameSite=Lax</code> flags.
        </p>
      </section>

      <section className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl not-prose">
        <h3 className="text-brand-primary font-bold flex items-center gap-2 mb-4">
          <ShieldCheck size={20} /> Data Privacy
        </h3>
        <p className="text-brand-primary text-sm">
          Aktionfy never logs the actual contents of your API keys or passwords. Even our Staff monitoring 
          views (Pass 5) only display masked identifiers and high-level execution metadata.
        </p>
      </section>
    </div>
  </>
);

// Minimal Crown icon helper
const ShieldCheck = ({ size, className }) => (
  <>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  </>
);

export { 
  Overview, 
  QuickStart, 
  InstallationDocs, 
  CoreConcepts, 
  ApiReference, 
  WorkerArchitecture, 
  ProtocolSpecDoc, 
  SecurityDocs 
};
