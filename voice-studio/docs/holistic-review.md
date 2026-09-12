# Review source in a Git repository

Open a local Git checkout in Studio to review its website or supported source
files. Studio reads the working copy, shows its source version and keeps decisions
and tasks beside the source.

## Identify the revision

In **File and Git**, check the source file, branch, resolved commit and local
changes before reviewing. Refresh after an external edit. You can also inspect
the checkout directly:

```sh
git branch --show-current
git rev-parse HEAD
git status --short
```

A clean file and a clean repository are different states. If the review uses
uncommitted changes, retain those contents with the review; the base commit alone
cannot reproduce them. For a running website, record its build identity as well.
The current checkout does not establish what a previously started server or the
published website is rendering.

## Git storage

Git stores the project's source and the review records selected for version
control. Studio writes its current records into the registered project:

```text
.voice-lint/
  reviews/<document-id>.voice-meta.json
  tasks/<document-id>/<task-id>.json
  semantic-runs/<run-id>/
  backups/<document-id>/
  transactions/
```

The [storage reference](workflow.md#files-beside-the-source) explains these files
and includes complete JSON examples. Studio does not create commits or alter the
project's ignore rules. Check the diff before committing review data: task/run
files can contain full source, prompts and model output; transaction journals
include a local backup path. Keep session credentials and installation registry
files outside shared review records.

## Review against a page goal

Record the intended audience, page purpose and claims to preserve in the source
task's instruction. Include the relevant approved context; when it comes from a
separate marketing repository, record that repository's commit and file path.
Studio does not automatically import a marketing context repository.

Review the mapped passages, keep intentional wording and save specific feedback.
For a broader change within one supported file, create and explicitly start a
source task. Its result retains the source version, run and proposed diff. Read
the complete diff before applying it, then run the configured project check and
inspect the rendered page.

Studio's project report aggregates file findings. Its current semantic review
and source tasks operate on one file with configured related context. A site-wide
SEO, consistency or visual assessment requires a separately scoped agent task;
there is no built-in holistic evaluator or AGT pipeline step yet.

## Retain the result

Keep the reviewed source, task/run records and relevant evidence together. Include
the capture time, route, viewport and build for screenshots, plus the command and
result for checks. A source hash detects changes but cannot restore the source.
Saved proposals show the task's historical diff; use Git for the current diff.

To check source and optional saved-task provenance against a running Studio:

```sh
npm run test:source-provenance -- --help
```

The command documents the required project/file arguments and writes a compact
report under `test-results/`. It does not infer a deployed website revision.
