const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

const replacements = [
  { from: /Identity \(Email\)/g, to: 'Email Address' },
  { from: /Desired Identity \(Email\)/g, to: 'Email Address' },
  { from: /Secure Protocol Key \(Password\)/g, to: 'Password' },
  { from: /Verify Protocol Key/g, to: 'Confirm Password' },
  { from: />Access Key</g, to: '>Password<' }, // targeted to Login.jsx label
  { from: /alternateLinkText="Request Identity"/g, to: 'alternateLinkText="Sign Up"' },
  { from: /alternateLinkMessage="New Actor\?"/g, to: 'alternateLinkMessage="New User?"' },
  { from: /submitText="Establish Connection"/g, to: 'submitText="Log In"' },
  { from: /subtitle="Account Initialization"/g, to: 'subtitle="Create Account"' },
  { from: /submitText="Request Initialization"/g, to: 'submitText="Sign Up"' },
  { from: /Establishing Connection.../g, to: 'Connecting...' },
  { from: /Establish a secure link between your local AI/g, to: 'Establish a secure link between your local machine' }
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
