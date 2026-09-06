namespace VoiceStudio;

public sealed partial class ProjectStore
{
    public string GetProjectRoot(string projectId)
    {
        lock (gate)
        {
            var root = Project(projectId).Root;
            EnsureNoLinks(root);
            return root;
        }
    }
}
