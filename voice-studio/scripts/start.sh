#!/usr/bin/env bash
set -euo pipefail
studio_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$studio_root"
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi
npm run build
if command -v cygpath >/dev/null 2>&1; then
  export VOICE_STUDIO_HOME="$(cygpath -m "$studio_root")"
else
  export VOICE_STUDIO_HOME="$studio_root"
fi
printf 'Voice Studio: http://127.0.0.1:5188\n'
printf 'Use the pairing code printed by the backend to open the local session.\n'
exec dotnet backend/VoiceStudio.Api/bin/Debug/net10.0/VoiceStudio.Api.dll
