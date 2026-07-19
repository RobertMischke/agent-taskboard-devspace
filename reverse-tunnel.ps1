# reverse-tunnel.ps1 - keep the Task Server reachable on the runner host.
# Doku: agent-taskboard-dev/docs/operations/setup/remote-runner-persistent-connection.md (Option A)
# Mapping: agent-runner 127.0.0.1:15031  ->  Studio Task Server 127.0.0.1:5031
# Laeuft als Windows Scheduled Task (uebersteht Sessions); Endlos-Loop mit Backoff.
while ($true) {
  try {
    & ssh -N `
      -o ServerAliveInterval=30 `
      -o ServerAliveCountMax=3 `
      -o ExitOnForwardFailure=yes `
      -o BatchMode=yes `
      -R 15031:127.0.0.1:5031 `
      agent-runner
  } catch { }
  Start-Sleep -Seconds 10
}
