const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src/pages');

const replacements = [
  // Neural variants
  { from: /Neural identity manifest/g, to: 'Identity manifest' },
  { from: /Neural SEO/g, to: 'SEO Configuration' },
  { from: /Neural Metadata Calibration/g, to: 'Metadata Calibration' },
  { from: /Neural Title \(Meta Title\)/g, to: 'Page Title (Meta Title)' },
  { from: /neural actor privileges/g, to: 'user privileges' },
  { from: /Neural Actor/g, to: 'System User' },
  { from: /Active Neural Streams/g, to: 'Active Task Streams' },
  { from: /Neural Streams/g, to: 'Task Streams' },
  { from: /Neural Access Key/g, to: 'API Access Key' },
  { from: /Neural Bridge/g, to: 'Local Bridge' },
  { from: /Neural Sandbox/g, to: 'Isolated Sandbox' },
  { from: /Neural Throughput/g, to: 'Task Throughput' },
  { from: /Neural Identity Authentication/g, to: 'User Authentication' },
  { from: /Active Neural Actors/g, to: 'Active Connections' },
  { from: /Neural Identity Generated/g, to: 'Account Generated' },
  { from: /Neural Identity Initialization/g, to: 'Account Initialization' },
  { from: /Neural rollback/g, to: 'System rollback' },
  { from: /Neural Timeline/g, to: 'Execution Timeline' },
  { from: /neural nodes/g, to: 'task nodes' },
  { from: /Neural node/g, to: 'Task node' },
  { from: /Neural Archive/g, to: 'Task Archive' },
  { from: /neural orchestration/g, to: 'task orchestration' },
  { from: /neural configuration/g, to: 'workflow configuration' },
  { from: /Neural Secret Vault/g, to: 'Secret Vault' },
  { from: /neural clients/g, to: 'external clients' },
  { from: /Neural Endpoint/g, to: 'Webhook Endpoint' },
  { from: /Neural links established/g, to: 'Node links established' },
  { from: /Neural Interconnect/g, to: 'Node Interconnect' },
  { from: /Neural Validation Passed/g, to: 'Workflow Validation Passed' },
  { from: /Neural Void/g, to: 'Empty Workspace' },
  { from: /Neural Inspector/g, to: 'Node Inspector' },
  { from: /Neural Frame Details/g, to: 'Node Details' },
  
  // Chrono-Flux
  { from: /Chrono-Flux/g, to: 'Activity Trend' },

  // Zero-Shot
  { from: /Zero-Shot Decision Routing/g, to: 'Smart Decision Routing' },
  { from: /zero-shot LLM classifier/g, to: 'intelligent LLM classifier' },

  // Reaper
  { from: /Manual Node Reaper/g, to: 'Manual Node Cleanup' },
  { from: /The Reaper Process/g, to: 'The Background Cleanup Process' },
  { from: /Reaper Registry/g, to: 'Worker Registry' },
  { from: /Active Reapers/g, to: 'Active Workers' },
  { from: /Stuck Task Reaper/g, to: 'Stuck Task Cleanup' },

  // Temporal
  { from: /Temporal execution record/g, to: 'Scheduled execution record' },
  { from: /Temporal Duration/g, to: 'Execution Duration' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { from, to } of replacements) {
        if (content.match(from)) {
          content = content.replace(from, to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
console.log('Replacement complete.');
