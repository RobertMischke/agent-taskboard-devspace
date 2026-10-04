#!/usr/bin/env bash
# Workstation policy: use remotely built, commit-pinned artifacts.
REMOTE_CONFIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${REMOTE_CONFIG_DIR}/.remote-execution.env" ]]; then
  source "${REMOTE_CONFIG_DIR}/.remote-execution.env"
fi
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) export PATH="/c/Program Files/Git/usr/bin:$PATH" ;; esac
# Preserve the environment previously selected by dotnet run launchSettings.
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export API_REQUIRE_PREBUILT=1
export RemoteGate__SshHost="${RemoteGate__SshHost:-agent-runner}"
export RemoteGate__Root="${RemoteGate__Root:-/var/tmp/agentstudio-remote-gates}"
export RemoteGate__ProcessorCount="${RemoteGate__ProcessorCount:-2}"
export DOTNET_PROCESSOR_COUNT="${DOTNET_PROCESSOR_COUNT:-4}"
export DOTNET_ThreadPool_ForceMinWorkerThreads="${DOTNET_ThreadPool_ForceMinWorkerThreads:-40}"

# Keep lifecycle inspection in Git Bash, including hosts where WMIC was removed.
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    export PATH="${REMOTE_CONFIG_DIR}/scripts/windows-process-tools:${PATH}"
    # These values name paths on Linux, not paths in the Git Bash installation.
    # Preserve other exclusions and leave native argument conversion untouched.
    for remote_path_variable in RemoteGate__WorkerPath RemoteGate__Root; do
      case ";${MSYS2_ENV_CONV_EXCL:-};" in
        *";$remote_path_variable;"*) ;;
        *) MSYS2_ENV_CONV_EXCL="${MSYS2_ENV_CONV_EXCL:+${MSYS2_ENV_CONV_EXCL};}$remote_path_variable" ;;
      esac
    done
    export MSYS2_ENV_CONV_EXCL
    unset remote_path_variable
    ;;
esac
