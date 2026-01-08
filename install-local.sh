#!/bin/bash

# usage: ./install-local.sh /path/to/your/vault
# example: ./install-local.sh "/Users/marco/Documents/My Vault"

# Load .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

PLUGIN_ID="obsidian-s3-publisher"

# Use command line argument if provided, otherwise use env var
VAULT_PATH="${1:-$OBSIDIAN_VAULT_PATH}"
# Remove trailing slash and expand tilde
VAULT_PATH="${VAULT_PATH%/}"
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

if [ -n "$INSTALLDIR" ]; then
    # Remove trailing slash and expand tilde from INSTALLDIR
    INSTALLDIR="${INSTALLDIR%/}"
    INSTALLDIR="${INSTALLDIR/#\~/$HOME}"
    
    # If INSTALLDIR is provided (e.g. from .env), use it as the base plugins folder
    # Example: INSTALLDIR=~/vault/.obsidian/plugins/
    TARGET_DIR="$INSTALLDIR/$PLUGIN_ID"
    # Ensure directory expansion if ~ is used (conceptually, though shell handles it mostly if unquoted, but better to be safe)
    # Actually, we should just trust the path.
    echo "Using INSTALLDIR from environment: $INSTALLDIR"
else
    # Fallback to Vault Path argument
    if [ -z "$VAULT_PATH" ]; then
      echo "Error: Vault path not provided."
      echo "Usage: ./install-local.sh <path-to-obsidian-vault>"
      echo "Or set INSTALLDIR in .env (e.g., INSTALLDIR=/path/to/vault/.obsidian/plugins)"
      exit 1
    fi
    TARGET_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"
fi

# We can't easily check for .obsidian existence if we use INSTALLDIR blindly, 
# but let's assume the user knows what they are doing if setting env var.
if [ -z "$INSTALLDIR" ] && [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "Error: Directory '$VAULT_PATH/.obsidian' does not exist."
    echo "Are you sure this is an Obsidian Vault?"
    exit 1
fi

echo "Building plugin..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed. Aborting."
    exit 1
fi

echo "Creating plugin directory at $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

echo "Copying files..."
cp main.js manifest.json styles.css "$TARGET_DIR/"

echo "✅ Installed successfully!"
echo "Reload Obsidian (Cmd+R) to load the new plugin code."
