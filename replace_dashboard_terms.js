const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

const replacements = [
  // Trace -> Logs
  { from: /Execution Traces/g, to: 'Execution Logs' },
  { from: /No traces found/g, to: 'No logs found' },
  { from: /Trace Details/g, to: 'Log Details' },

  // Payload -> Data
  { from: /Input Payload/g, to: 'Input Data' },
  { from: /Test payload/g, to: 'Test data' },
  { from: /Sensitive Payload/g, to: 'Sensitive Data' },
  { from: /Modify Payload/g, to: 'Modify Data' },
  { from: /Raw 256-bit payload/g, to: 'Raw data' },
  { from: /outbound payloads/g, to: 'outbound data' },
  { from: /Request Payload Preview/g, to: 'Request Data Preview' },

  // Orchestration -> Automation
  { from: /Orchestration Wizard/g, to: 'Task Wizard' },
  { from: /orchestration streams/gi, to: 'automation tasks' },
  { from: /Fire First Orchestration/g, to: 'Create First Task' },
  { from: /Global orchestration overview/g, to: 'Global automation overview' },
  { from: /Persistent orchestration threads/g, to: 'Persistent automation tasks' },
  { from: /orchestration engine/gi, to: 'automation engine' },
  { from: /Redis orchestration/g, to: 'Redis automation' },
  { from: /orchestration node/gi, to: 'automation task' },
  { from: /Visual orchestration designer/g, to: 'Visual automation designer' },
  { from: /Autonomous Task Orchestration/g, to: 'Autonomous Task Automation' },
  { from: /high-frequency task orchestration/g, to: 'high-frequency task automation' },
  { from: /orchestration paths/g, to: 'automation paths' },

  // Node -> Task (Careful matching to avoid breaking HTML elements like Node/nodes in DOM)
  { from: /Initialize Node/g, to: 'Create Task' },
  { from: /Node Designation/g, to: 'Task Name' },
  { from: /Node ID/g, to: 'Task ID' },
  { from: /Execute Node Now/g, to: 'Execute Task Now' },
  { from: /task nodes/g, to: 'tasks' },
  { from: /Task node/g, to: 'Task' },
  { from: /Nodes Linked/g, to: 'Tasks Linked' },
  { from: /Thaw Nodes/g, to: 'Resume Tasks' },
  { from: /Zombie nodes/gi, to: 'stuck tasks' },
  { from: /Node Pruning Lease/g, to: 'Task Cleanup Lease' },
  { from: /Manual Node Cleanup/g, to: 'Manual Task Cleanup' },
  { from: /Background Compute Nodes/g, to: 'Background Tasks' },
  { from: /Node Inspector/g, to: 'Task Details' }, // We previously replaced Neural Inspector -> Node Inspector
  { from: /Node Details/g, to: 'Task Details' }, // Previously Neural Frame Details -> Node Details
  { from: /Node Interconnect/g, to: 'Task Connections' }, 
  { from: /Node links established/g, to: 'Task links established' },
  { from: /Calibrate Node/g, to: 'Edit Task' },
  { from: /LLM Node/g, to: 'LLM Task' },
  { from: /Decision Node/g, to: 'Decision Task' },
  { from: /Node Success/g, to: 'Task Success' },

  // Impersonation
  { from: /Impersonation session established/gi, to: 'Login session established' },
  { from: /initiate impersonation/g, to: 'login as user' }
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
