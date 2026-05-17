#!/bin/bash

set -e

# --- Configuration ---
BINARY_NAME="aktionfy"
REPO_OWNER="akhilkumar332"
REPO_NAME="aktionfy"
GITHUB_RELEASE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download"

# --- Colors for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    printf "${BLUE}[INFO]${NC} %s\n" "$1"
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1"
}

# --- 1. Detect OS and Arch ---
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "${ARCH}" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) log_error "Unsupported architecture: ${ARCH}"; exit 1 ;;
esac

case "${OS}" in
    linux) OS="linux" ;;
    darwin) OS="darwin" ;;
    *) log_error "Unsupported OS: ${OS}"; exit 1 ;;
esac

log_info "Detected OS: ${OS}, Architecture: ${ARCH}"

# --- 2. Check for curl or wget ---
DOWNLOAD_TOOL=""
if command -v curl >/dev/null 2>&1; then
    DOWNLOAD_TOOL="curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOAD_TOOL="wget"
else
    log_error "Neither curl nor wget found. Please install one of them."
    exit 1
fi

log_info "Using ${DOWNLOAD_TOOL} for downloading."

# --- 3. Prepare download URL ---
# Format: aktionfy-linux-amd64
DOWNLOAD_URL="${GITHUB_RELEASE_URL}/${BINARY_NAME}-${OS}-${ARCH}"

log_info "Download URL would be: ${DOWNLOAD_URL}"

# --- 4. Installation ---
INSTALL_DIR="/usr/local/bin"
USE_SUDO=""

if [ ! -w "${INSTALL_DIR}" ]; then
    if [ "$(id -u)" -ne 0 ]; then
        log_info "Installation directory ${INSTALL_DIR} is not writable. Will try to use sudo or install to ~/.local/bin."
        if command -v sudo >/dev/null 2>&1; then
            USE_SUDO="sudo"
        else
            INSTALL_DIR="${HOME}/.local/bin"
            mkdir -p "${INSTALL_DIR}"
            log_info "Sudo not found. Installing to ${INSTALL_DIR} instead."
        fi
    fi
fi

log_info "Installation target: ${INSTALL_DIR}/${BINARY_NAME}"

# MOCK DOWNLOAD AND INSTALLATION FOR NOW
log_info "MOCK: Downloading ${BINARY_NAME}..."
# In a real script, we would do:
# if [ "${DOWNLOAD_TOOL}" = "curl" ]; then
#     ${USE_SUDO} curl -SL "${DOWNLOAD_URL}" -o "${INSTALL_DIR}/${BINARY_NAME}"
# else
#     ${USE_SUDO} wget -O "${INSTALL_DIR}/${BINARY_NAME}" "${DOWNLOAD_URL}"
# fi

log_info "MOCK: Moving binary to ${INSTALL_DIR}/${BINARY_NAME}"
log_info "MOCK: Setting execution permissions..."
# ${USE_SUDO} chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

log_success "${BINARY_NAME} installation completed (MOCKED)."
log_info "To use it, ensure ${INSTALL_DIR} is in your PATH."
