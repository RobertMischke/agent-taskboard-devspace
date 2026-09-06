import { copyFile, mkdir } from "node:fs/promises";

// Angular serves workspace-local assets. Keep the versioned root catalog as the
// only maintained source, and copy just that public file before build or serve.
const source = new URL("../../knowledge/rules.json", import.meta.url);
const directory = new URL("../.generated/knowledge/", import.meta.url);
await mkdir(directory, { recursive: true });
await copyFile(source, new URL("rules.json", directory));
