const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

const replacements = [
  // Topology
  { from: /Mapping Topology\.\.\./g, to: 'Loading Workspace...' },

  // Telemetry
  { from: /Real-time Telemetry/g, to: 'Real-time Analytics' },
  { from: /Live Telemetry/g, to: 'Live Analytics' },
  { from: /Real-time telemetry stream/g, to: 'Real-time analytics stream' },
  { from: /Global Performance Telemetry/g, to: 'Global Performance Analytics' },
  { from: /telemetry signal/g, to: 'analytics signal' },
  { from: /infrastructure telemetry/g, to: 'infrastructure analytics' },
  { from: /Refresh telemetry/g, to: 'Refresh analytics' },
  { from: /Core Logic & Telemetry/g, to: 'Core Logic & Analytics' },
  { from: /Telemetry Deck/g, to: 'Analytics Deck' },
  { from: /telemetry data recorded/g, to: 'analytics data recorded' },
  { from: /system telemetry/g, to: 'system analytics' },
  { from: /grep telemetry/g, to: 'search analytics' },

  // Registry
  { from: /Task Registry/g, to: 'Task List' },
  { from: /central registry/g, to: 'central database' },
  { from: /Registry Terminal/g, to: 'Admin Terminal' },
  { from: /Querying Registry\.\.\./g, to: 'Querying Data...' },
  { from: /Registry synchronized/g, to: 'Data synchronized' },
  { from: /Vault registry void/g, to: 'Vault is empty' },
  { from: /Worker Registry/g, to: 'Worker List' },
  { from: /Refresh registry/g, to: 'Refresh list' },

  // Void
  { from: /Vault registry void\./g, to: 'Vault is empty.' },

  // Manifest
  { from: /LobeChat Manifest/g, to: 'LobeChat Configuration' },
  { from: /Logic Manifest/g, to: 'Task Logic' },
  { from: /Identity manifest/g, to: 'Account settings' },
  { from: /broadcast manifest/g, to: 'broadcast settings' },
  { from: /Broadcast Manifest/g, to: 'Broadcast Settings' },
  { from: /Syncing Broadcast Manifest/g, to: 'Syncing Broadcast Settings' },
  { from: /Manifest Logic/g, to: 'Settings Logic' },

  // Cryptographic
  { from: /secure neural sector and generate your cryptographically signed access key/g, to: 'secure environment and generate your API password' }
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
