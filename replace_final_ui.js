const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

const replacements = [
  // Vector -> Trigger
  { from: /Initiation Vector/g, to: 'Task Trigger' },
  { from: /All Vectors/g, to: 'All Triggers' },
  { from: /Vector Type/g, to: 'Trigger Type' },
  { from: />Vector</g, to: '>Trigger<' }, // specific matching to avoid replacing the file name / code vars
  { from: /name: 'Vector'/g, to: "name: 'Trigger'" }, // In TaskWizard.jsx step name

  // IPC bridge
  { from: /IPC bridge/g, to: 'secure connection' }
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
