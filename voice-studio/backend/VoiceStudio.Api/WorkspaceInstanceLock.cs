using System.Text;

namespace VoiceStudio;

/// <summary>Hold the returned stream for the entire host lifetime, before rotating credentials.</summary>
public static class WorkspaceInstanceLock
{
    public static FileStream? TryAcquire(string sessionRoot)
    {
        var path = Path.Combine(sessionRoot, "server.lock");
        ProjectStore.EnsureNoLinks(path);
        FileStream stream;
        try { stream = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { return null; }
        try
        {
            stream.SetLength(0);
            stream.Write(Encoding.UTF8.GetBytes(Environment.ProcessId.ToString()));
            stream.Flush(true);
            return stream;
        }
        catch { stream.Dispose(); throw; }
    }
}
