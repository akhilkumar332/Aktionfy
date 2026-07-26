const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

const replacements = [
  // Dead Letter Queues
  { from: /dead letter queues/g, to: 'failed task queues' },
  { from: /node reapers/g, to: 'task cleaners' }, // Missed this one earlier in Features.jsx

  // State Machine
  { from: /state machine/g, to: 'workflow engine' },

  // Governance
  { from: /Node Governance/g, to: 'Task Management' },

  // Swarm
  { from: /Swarm/g, to: 'Team' },
  { from: /swarm synchronization/g, to: 'team synchronization' },
  { from: /swarm logic/g, to: 'team logic' },
  { from: /SWARM_PROTOCOL_INIT/g, to: 'TEAM_PROTOCOL_INIT' },

  // Blueprints
  { from: /Industrial blueprints/g, to: 'Ready-to-use templates' },
  { from: /industrial blueprints/g, to: 'ready-to-use templates' },

  // High-fidelity
  { from: /High-fidelity observability/g, to: 'Clear monitoring' },
  { from: /Durable scheduling/g, to: 'Reliable scheduling' }
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
