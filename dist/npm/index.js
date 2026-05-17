#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const BINARY_NAME = platform === 'win32' ? 'aktionfy.exe' : 'aktionfy';
const binaryPath = path.join(__dirname, BINARY_NAME);

const args = process.argv.slice(2);

const child = spawn(binaryPath, args, {
    stdio: 'inherit',
    shell: false
});

child.on('error', (err) => {
    console.error(`Failed to start Scheduled Actions MCP: ${err.message}`);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code);
});
