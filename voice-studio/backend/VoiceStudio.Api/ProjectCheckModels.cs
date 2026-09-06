namespace VoiceStudio;

public sealed record ProjectCheckConfiguration(bool Configured, bool Startable, string? Label = null, string? Message = null,
    string? CurrentSourceVersion = null, string? ConfigurationVersion = null, int? TimeoutSeconds = null,
    int? InputFileCount = null, long? InputBytes = null, int LogLimitChars = 65536);
public sealed record ProjectCheckRun(string Id, string ProjectId, string Label, string SourceVersion, string ConfigurationVersion,
    string Status, DateTimeOffset CreatedAt, DateTimeOffset StartedAt, DateTimeOffset? CompletedAt, int? ExitCode,
    string? Error, string Log, bool LogTruncated, int InputFileCount, long InputBytes, string? Outcome = null);
public sealed record ProjectCheckStartInput(string ExpectedSourceVersion, string ExpectedConfigurationVersion, string RequestId);
public sealed record ProjectCheckProfile(string ProjectPath, string Label, string Executable, string[] Arguments,
    string[] InputDirectories, string[] InputFiles, string[] RequiredFiles, int TimeoutSeconds = 600);
public sealed record ProjectCheckHostConfiguration(int Version, ProjectCheckProfile[] Profiles);
public sealed record CheckProcessCommand(string Executable, string[] Arguments, string WorkingDirectory);
public interface IProjectCheckProcess
{
    Task<int> RunAsync(CheckProcessCommand command, Action<string> output, CancellationToken cancellationToken);
}
