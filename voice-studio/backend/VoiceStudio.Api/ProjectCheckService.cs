using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VoiceStudio;

/// <summary>Explicit host-configured local check. Executes trusted project code; before/after
/// fingerprints are optimistic guards, not an immutable snapshot or a process sandbox.</summary>
public sealed class ProjectCheckService : IDisposable
{
    public const int LogLimit = 65536, MaxFiles = 2000;
    public const long MaxBytes = 64L * 1024 * 1024, MaxFileBytes = 8L * 1024 * 1024;
    private const int MaxRuns = 200;
    private readonly object gate = new();
    private readonly ProjectStore store;
    private readonly IProjectCheckProcess process;
    private readonly Action<string, string> writeFile;
    private readonly ProjectCheckProfile[] profiles = [];
    private readonly string? configurationError;
    private ActiveCheck? active;
    private bool disposed;

    public ProjectCheckService(ProjectStore store, string configurationPath, IProjectCheckProcess? process = null, Action<string, string>? writeFile = null)
    {
        this.store = store;
        this.process = process ?? new ProjectCheckProcess();
        this.writeFile = writeFile ?? ProjectStore.AtomicWrite;
        try
        {
            if (!Path.IsPathFullyQualified(configurationPath)) throw new InvalidDataException();
            ProjectStore.EnsureNoLinks(configurationPath);
            if (!File.Exists(configurationPath)) return;
            if (new FileInfo(configurationPath).Length > 65536) throw new InvalidDataException();
            var config = JsonSerializer.Deserialize<ProjectCheckHostConfiguration>(File.ReadAllText(configurationPath), ProjectStore.Json);
            if (config is null || config.Version != 1 || config.Profiles is null || config.Profiles.Length > 20) throw new InvalidDataException();
            var roots = new HashSet<string>(PathComparer);
            foreach (var profile in config.Profiles)
            {
                ValidateProfile(profile, configurationPath);
                if (!roots.Add(Canonical(profile.ProjectPath))) throw new InvalidDataException();
            }
            profiles = config.Profiles;
        }
        catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException or JsonException or ApiError or ArgumentException)
        { configurationError = "Private Hostkonfiguration ungültig. Bitte am Host prüfen; kein Prozess wird gestartet."; }
    }

    public ProjectCheckConfiguration Configuration(string projectId)
    {
        lock (gate)
        {
            var root = store.GetProjectRoot(projectId);
            var profile = Profile(root);
            if (profile is null) return new(false, false, Message: configurationError ?? "Für dieses Projekt ist keine lokale Prüfung am Host konfiguriert.");
            try
            {
                var snapshot = Snapshot(root, profile);
                var prerequisite = Prerequisite(root, profile);
                return new(true, prerequisite is null && active is null, profile.Label,
                    prerequisite ?? (active is null ? null : "Eine lokale Projektprüfung läuft bereits."), snapshot.Version,
                    ProfileVersion(profile), profile.TimeoutSeconds, snapshot.FileCount, snapshot.Bytes);
            }
            catch (Exception error) when (error is ApiError or IOException or UnauthorizedAccessException)
            { return new(true, false, profile.Label, "Prüfeingaben nicht sicher lesbar oder außerhalb der Grenzen. " + SafeError(error), ConfigurationVersion: ProfileVersion(profile), TimeoutSeconds: profile.TimeoutSeconds); }
        }
    }

    public ProjectCheckRun Start(string projectId, ProjectCheckStartInput input)
    {
        lock (gate)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (string.IsNullOrWhiteSpace(input.RequestId) || input.RequestId.Length > 128 || input.RequestId.Any(char.IsControl) || (!HashValid(input.ExpectedSourceVersion) || !HashValid(input.ExpectedConfigurationVersion)))
                throw new ApiError(400, "Request-ID sowie aktuelle Quell- und Konfigurationsfingerprints sind erforderlich.");
            var root = store.GetProjectRoot(projectId);
            var records = ReadRecords(root, projectId);
            var existing = records.FirstOrDefault(x => x.RequestId == input.RequestId);
            if (existing is not null)
            {
                if (existing.Run.SourceVersion != input.ExpectedSourceVersion || existing.Run.ConfigurationVersion != input.ExpectedConfigurationVersion) throw new ApiError(409, "Request-ID wurde bereits für einen anderen Quellstand oder eine andere Prüfkonfiguration verwendet.");
                return Refresh(root, existing, CurrentVersion(root), true).Run;
            }
            if (active is not null) throw new ApiError(409, "Eine lokale Projektprüfung läuft bereits. Bitte abwarten oder abbrechen.");
            if (records.Length >= MaxRuns) throw new ApiError(409, "Prüfverlauf enthält 200 Läufe. Bitte alte Prüfmetadaten am Host archivieren.");
            var profile = Profile(root) ?? throw new ApiError(409, configurationError ?? "Keine lokale Prüfung am Host konfiguriert.");
            if (ProfileVersion(profile) != input.ExpectedConfigurationVersion) throw new ApiError(409, "Prüfkonfiguration hat sich geändert. Prüfung neu laden.");
            var snapshot = Snapshot(root, profile);
            if (snapshot.Version != input.ExpectedSourceVersion) throw new ApiError(409, "Projektstand hat sich geändert. Prüfung neu laden.");
            var prerequisite = Prerequisite(root, profile);
            if (prerequisite is not null) throw new ApiError(409, prerequisite);
            var now = DateTimeOffset.UtcNow;
            var run = new ProjectCheckRun(Guid.NewGuid().ToString("N"), projectId, profile.Label, snapshot.Version, ProfileVersion(profile),
                "running", now, now, null, null, null, "", false, snapshot.FileCount, snapshot.Bytes);
            var record = new CheckRecord(input.RequestId, run);
            Save(root, record);
            active = new ActiveCheck(root, record, profile);
            var execution = active;
            execution.Work = Task.Run(() => Execute(execution));
            return run;
        }
    }

    public ProjectCheckRun[] List(string projectId)
    {
        lock (gate)
        {
            var root = store.GetProjectRoot(projectId);
            var version = CurrentVersion(root);
            return ReadRecords(root, projectId).Select(record => Refresh(root, record, version, true).Run)
                .OrderByDescending(run => run.CreatedAt).Take(50).ToArray();
        }
    }
    public ProjectCheckRun Get(string projectId, string id)
    {
        lock (gate)
        {
            ValidateId(id);
            var root = store.GetProjectRoot(projectId);
            return Refresh(root, Read(root, projectId, id), CurrentVersion(root), true).Run;
        }
    }
    public ProjectCheckRun Cancel(string projectId, string id)
    {
        lock (gate)
        {
            ValidateId(id);
            var root = store.GetProjectRoot(projectId);
            var record = Read(root, projectId, id);
            if (IsActive(record.Run))
            {
                var execution = active!;
                execution.Record = execution.Record with { Run = execution.Record.Run with { Status = "cancelling" } };
                var response = execution.Record.Run;
                try { Save(root, execution.Record); }
                finally { execution.Cancel.Cancel(); }
                return response;
            }
            return Refresh(root, record, CurrentVersion(root), true).Run;
        }
    }

    private async Task Execute(ActiveCheck execution)
    {
        int? exitCode = null;
        string outcome;
        string? error = null;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(execution.Profile.TimeoutSeconds));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, execution.Cancel.Token);
        try
        {
            // Recheck after leaving the HTTP call and immediately before launching the fixed command.
            if (Snapshot(execution.Root, execution.Profile).Version != execution.Record.Run.SourceVersion) throw new ApiError(409, "Projektstand änderte sich vor dem Prozessstart.");
            var prerequisite = Prerequisite(execution.Root, execution.Profile);
            if (prerequisite is not null) throw new ApiError(409, prerequisite);
            ProjectStore.EnsureNoLinks(execution.Profile.Executable);
            if (!File.Exists(execution.Profile.Executable)) throw new ApiError(409, "Konfiguriertes Programm fehlt.");
            exitCode = await process.RunAsync(new(execution.Profile.Executable, execution.Profile.Arguments, execution.Root), chunk => AppendLog(execution, chunk), linked.Token);
            linked.Token.ThrowIfCancellationRequested();
            outcome = exitCode == 0 ? "completed" : "failed";
            if (exitCode != 0) error = "Prüfprozess meldete einen Fehler.";
        }
        catch (OperationCanceledException)
        {
            outcome = execution.Stopping || timeout.IsCancellationRequested ? "failed" : "cancelled";
            error = execution.Stopping ? "Dienst wurde beendet; Prüfung wurde unterbrochen." : timeout.IsCancellationRequested ? "Zeitlimit der lokalen Prüfung erreicht." : "Prüfung wurde abgebrochen.";
        }
        catch (Exception exception) { outcome = "failed"; error = "Prüfprozess fehlgeschlagen. " + SafeError(exception); }
        lock (gate)
        {
            var version = CurrentVersion(execution.Root);
            var run = execution.Record.Run;
            var stale = version.Source != run.SourceVersion || version.Configuration != run.ConfigurationVersion;
            execution.Record = execution.Record with { Run = run with { Status = stale ? "stale" : outcome, Outcome = outcome, ExitCode = exitCode, Error = error, CompletedAt = DateTimeOffset.UtcNow } };
            try { Save(execution.Root, execution.Record); }
            finally { if (ReferenceEquals(active, execution)) active = null; execution.Cancel.Dispose(); }
        }
    }
    private void AppendLog(ActiveCheck execution, string chunk)
    {
        lock (gate)
        {
            var run = execution.Record.Run;
            var remaining = LogLimit - run.Log.Length;
            var clean = new string(chunk.Where(c => !char.IsControl(c) || c is '\n' or '\r' or '\t').ToArray());
            execution.Record = execution.Record with { Run = run with { Log = run.Log + clean[..Math.Min(remaining, clean.Length)], LogTruncated = run.LogTruncated || clean.Length > remaining } };
            if (DateTimeOffset.UtcNow - execution.LastFlush > TimeSpan.FromSeconds(1))
            { Save(execution.Root, execution.Record); execution.LastFlush = DateTimeOffset.UtcNow; }
        }
    }
    private bool IsActive(ProjectCheckRun run) => active is not null && active.Record.Run.Id == run.Id && active.Record.Run.ProjectId == run.ProjectId;
    private CheckRecord Refresh(string root, CheckRecord record, (string? Source, string? Configuration) version, bool persist)
    {
        var run = record.Run;
        if (IsActive(run)) { if (persist) Save(root, active!.Record); return active!.Record; }
        if (run.Status is "running" or "cancelling")
            run = run with { Status = "failed", Outcome = "failed", Error = "Dienstneustart: vorherige Prüfung unterbrochen; kein automatischer Neustart.", CompletedAt = DateTimeOffset.UtcNow };
        if (run.Status != "stale" && (version.Source != run.SourceVersion || version.Configuration != run.ConfigurationVersion)) run = run with { Status = "stale" };
        if (run != record.Run) { record = record with { Run = run }; if (persist) Save(root, record); }
        return record;
    }
    private (string? Source, string? Configuration) CurrentVersion(string root)
    {
        var profile = Profile(root);
        if (profile is null) return (null, null);
        try { return (Snapshot(root, profile).Version, ProfileVersion(profile)); }
        catch (Exception exception) when (exception is ApiError or IOException or UnauthorizedAccessException) { return (null, ProfileVersion(profile)); }
    }
    private ProjectCheckProfile? Profile(string root) => profiles.FirstOrDefault(profile => PathComparer.Equals(Canonical(profile.ProjectPath), Canonical(root)));
    private static string ProfileVersion(ProjectCheckProfile profile) => ProjectStore.Hash(JsonSerializer.Serialize(profile, ProjectStore.Json));
    private static string Canonical(string path) => Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    private static StringComparer PathComparer => OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
    private static bool IsInside(string root, string path) => PathComparer.Equals(Canonical(root), Canonical(path)) || Canonical(path).StartsWith(Canonical(root) + Path.DirectorySeparatorChar, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
    private static void ValidateProfile(ProjectCheckProfile profile, string configurationPath)
    {
        if (profile is null || !Path.IsPathFullyQualified(profile.ProjectPath ?? "") || !Directory.Exists(profile.ProjectPath) ||
            !Path.IsPathFullyQualified(profile.Executable ?? "") || !File.Exists(profile.Executable) || string.IsNullOrWhiteSpace(profile.Label) || profile.Label.Length > 120 ||
            profile.TimeoutSeconds is < 1 or > 1200 || profile.Arguments is null || profile.Arguments.Length > 50 || profile.Arguments.Any(arg => arg is null || arg.Length > 4096 || arg.Contains('\0')) ||
            profile.InputDirectories is null || profile.InputFiles is null || profile.RequiredFiles is null || profile.InputDirectories.Length + profile.InputFiles.Length is 0 or > 100 || profile.RequiredFiles.Length is 0 or > 50)
            throw new InvalidDataException();
        if (IsInside(profile.ProjectPath, configurationPath) || IsInside(profile.ProjectPath, profile.Executable)) throw new InvalidDataException("Hostkonfiguration und Programm müssen außerhalb des Projekts liegen.");
        if (profile.ProjectPath.StartsWith(@"\\") || profile.Executable.StartsWith(@"\\")) throw new InvalidDataException();
        ProjectStore.EnsureNoLinks(profile.ProjectPath);
        ProjectStore.EnsureNoLinks(profile.Executable);
        foreach (var path in profile.InputDirectories.Concat(profile.InputFiles).Concat(profile.RequiredFiles))
        {
            if (string.IsNullOrWhiteSpace(path) || path.Length > 512 || Path.IsPathRooted(path) || path.Contains('*') || path.Contains('?')) throw new InvalidDataException("Nur feste relative Eingabepfade sind zugelassen.");
            ProjectStore.Contained(profile.ProjectPath, path);
        }
        foreach (var path in profile.InputDirectories.Concat(profile.InputFiles))
            if (path.Replace('\\', '/').Split('/').Any(part => part is ".git" or ".voice-lint" or ".voice-studio" or "node_modules" or "dist" or ".angular" or "bin" or "obj")) throw new InvalidDataException();
    }
    private static string? Prerequisite(string root, ProjectCheckProfile profile)
    {
        foreach (var relative in profile.RequiredFiles)
            if (!File.Exists(ProjectStore.Contained(root, relative))) return "Voraussetzung fehlt: " + relative + ". Dependencies bitte außerhalb der Prüfung installieren; Start ist gesperrt.";
        return null;
    }
    private static SourceSnapshot Snapshot(string root, ProjectCheckProfile profile)
    {
        ProjectStore.EnsureNoLinks(root);
        var files = new SortedSet<string>(StringComparer.Ordinal);
        var hashes = new List<string>();
        var visited = 0;
        void Add(string path)
        {
            files.Add(Path.GetRelativePath(root, path).Replace('\\', '/'));
            if (files.Count > MaxFiles) throw new ApiError(409, "Mehr als 2000 Prüfeingaben.");
        }
        void Walk(string path, int depth)
        {
            if (depth > 20 || ++visited > MaxFiles) throw new ApiError(409, "Verzeichnisgrenze der Prüfung überschritten.");
            ProjectStore.EnsureNoLinks(path);
            foreach (var entry in Directory.EnumerateFileSystemEntries(path))
            {
                ProjectStore.EnsureNoLinks(entry);
                if (Directory.Exists(entry)) Walk(entry, depth + 1);
                else if (File.Exists(entry)) Add(entry);
            }
        }
        foreach (var relative in profile.InputDirectories)
        {
            var path = ProjectStore.Contained(root, relative);
            if (!Directory.Exists(path)) throw new ApiError(409, "Konfiguriertes Quellverzeichnis fehlt: " + relative);
            hashes.Add("directory:" + relative);
            Walk(path, 0);
        }
        foreach (var relative in profile.InputFiles)
            if (!File.Exists(ProjectStore.Contained(root, relative))) throw new ApiError(409, "Konfigurierte Quelldatei fehlt: " + relative);
        foreach (var relative in profile.InputFiles.Concat(profile.RequiredFiles))
        {
            var path = ProjectStore.Contained(root, relative);
            hashes.Add("file:" + relative + ":" + File.Exists(path));
            if (File.Exists(path)) Add(path);
        }
        long bytes = 0;
        foreach (var relative in files)
        {
            using var stream = new FileStream(ProjectStore.Contained(root, relative), FileMode.Open, FileAccess.Read, FileShare.Read);
            if (stream.Length > MaxFileBytes || bytes + stream.Length > MaxBytes) throw new ApiError(409, "Prüfeingaben überschreiten 8 MiB je Datei oder 64 MiB gesamt.");
            var length = stream.Length;
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var buffer = new byte[8192];
            long readBytes = 0;
            int read;
            while ((read = stream.Read(buffer)) > 0)
            {
                readBytes += read;
                if (readBytes > MaxFileBytes || bytes + readBytes > MaxBytes) throw new ApiError(409, "Prüfeingaben wuchsen über die Grenze.");
                hash.AppendData(buffer, 0, read);
            }
            if (length != readBytes) throw new ApiError(409, "Prüfeingabe änderte sich beim Einlesen.");
            bytes += readBytes;
            hashes.Add(relative + ":" + Convert.ToHexStringLower(hash.GetHashAndReset()));
        }
        return new(ProjectStore.Hash(JsonSerializer.Serialize(hashes)), files.Count, bytes);
    }
    private static string DirectoryPath(string root) => ProjectStore.Contained(root, ".voice-lint/check-runs");
    private static string RunPath(string root, string id) { ValidateId(id); return ProjectStore.Contained(root, $".voice-lint/check-runs/{id}.json"); }
    private void Save(string root, CheckRecord record)
    {
        var path = RunPath(root, record.Run.Id);
        Directory.CreateDirectory(DirectoryPath(root));
        ProjectStore.EnsureNoLinks(Path.GetDirectoryName(path)!);
        writeFile(path, JsonSerializer.Serialize(record, ProjectStore.Json));
    }
    private static CheckRecord Read(string root, string projectId, string id)
    {
        var path = RunPath(root, id);
        if (!File.Exists(path)) throw new ApiError(404, "Prüflauf nicht gefunden.");
        if (new FileInfo(path).Length > 1024 * 1024) throw new ApiError(409, "Prüfmetadaten sind zu groß.");
        CheckRecord? record;
        try { record = JsonSerializer.Deserialize<CheckRecord>(File.ReadAllText(path), ProjectStore.Json); }
        catch (JsonException) { throw new ApiError(409, "Prüfmetadaten sind ungültig."); }
        if (record?.Run is not { } run || run.Id != id || run.ProjectId != projectId || string.IsNullOrEmpty(record.RequestId) || record.RequestId.Length > 128 ||
            run.Log is null || run.Log.Length > LogLimit || !HashValid(run.SourceVersion) || !HashValid(run.ConfigurationVersion) || run.Status is not ("running" or "cancelling" or "completed" or "failed" or "cancelled" or "stale"))
            throw new ApiError(409, "Prüfmetadaten passen nicht zum Projekt oder Format.");
        return record;
    }
    private static CheckRecord[] ReadRecords(string root, string projectId)
    {
        var directory = DirectoryPath(root);
        if (!Directory.Exists(directory)) return [];
        var paths = Directory.EnumerateFiles(directory, "*.json").Take(MaxRuns + 1).ToArray();
        if (paths.Length > MaxRuns) throw new ApiError(409, "Zu viele lokale Prüfmetadaten; bitte am Host archivieren.");
        return paths.Select(path => Read(root, projectId, Path.GetFileNameWithoutExtension(path))).ToArray();
    }
    private static bool HashValid(string? value) => Regex.IsMatch(value ?? "", "^[a-f0-9]{64}$");
    private static void ValidateId(string id) { if (!Regex.IsMatch(id ?? "", "^[a-f0-9]{32}$")) throw new ApiError(400, "Ungültige Prüflauf-ID."); }
    private static string SafeError(Exception error) => error is ApiError ? error.Message : error.GetType().Name;
    public void Dispose()
    {
        Task? work;
        lock (gate) { disposed = true; work = active?.Work; if (active is not null) { active.Stopping = true; active.Cancel.Cancel(); } }
        try { work?.Wait(TimeSpan.FromSeconds(10)); } catch (AggregateException) { }
    }
    private sealed record SourceSnapshot(string Version, int FileCount, long Bytes);
    private sealed record CheckRecord(string RequestId, ProjectCheckRun Run);
    private sealed class ActiveCheck(string root, CheckRecord record, ProjectCheckProfile profile)
    {
        public string Root { get; } = root;
        public CheckRecord Record { get; set; } = record;
        public ProjectCheckProfile Profile { get; } = profile;
        public CancellationTokenSource Cancel { get; } = new();
        public Task? Work { get; set; }
        public DateTimeOffset LastFlush { get; set; } = DateTimeOffset.MinValue;
        public bool Stopping { get; set; }
    }
}
