const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform(); // linux, darwin, win32
const arch = os.arch() === 'x64' ? 'amd64' : os.arch(); // Map x64 to amd64

let githubPlatform = platform;
if (platform === 'win32') githubPlatform = 'windows';

const BINARY_NAME = platform === 'win32' ? 'aktionfy.exe' : 'aktionfy';
const GITHUB_BINARY_NAME = platform === 'win32' ? `aktionfy-${githubPlatform}-${arch}.exe` : `aktionfy-${githubPlatform}-${arch}`;
const DEST_PATH = path.join(__dirname, BINARY_NAME);
const LOCAL_BIN_PATH = path.join(__dirname, '..', 'bin', GITHUB_BINARY_NAME);

console.log(`Installing Aktionfy MCP for ${platform}-${arch}...`);

async function install() {
    console.log(`Looking for local binary at: ${LOCAL_BIN_PATH}`);
    
    if (fs.existsSync(LOCAL_BIN_PATH)) {
        console.log('Found local binary, copying to npm package directory...');
        fs.copyFileSync(LOCAL_BIN_PATH, DEST_PATH);
    } else {
        console.error(`Error: Local binary not found at ${LOCAL_BIN_PATH}.`);
        console.error('Please build the Go binaries first using the provided build scripts.');
        process.exit(1);
    }

    if (platform !== 'win32') {
        fs.chmodSync(DEST_PATH, 0o755);
        console.log(`Set execution permissions on ${BINARY_NAME}`);
    }
    
    console.log('Installation complete.');
}

install().catch(err => {
    console.error('Installation failed:', err);
    process.exit(1);
});
