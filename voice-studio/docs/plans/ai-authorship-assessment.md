# AI authorship assessment: qualification decision

Status: research decision, 12 September 2026. No detector implementation or model qualification is claimed.

Voice ships transparent writing signals independently of authorship. A detector adapter should only be added after a named implementation has been evaluated on the intended product corpus. Do not derive an AI probability from counts of editorial findings.

## Qualification dataset

Keep permission-cleared, versioned fixtures in Git with collection provenance. Split by source document and author to avoid train/test leakage. Include English and German public product documentation, short UI copy, release notes, code-adjacent prose, human writing, generated output from exact recorded model versions, human-edited AI drafts, AI-edited human drafts and translations. Preserve a held-out time/model/domain slice. Mark mixed or unknown origin without forcing a binary label.

## Evaluate

Record precision and recall at the intended threshold, false-positive rates by language/background/genre/length, coverage and abstentions, calibration if a probability is exposed, and performance on unseen models and edits. Show confidence intervals and sample sizes. Compare with a trivial baseline and the cost of leaving origin unknown. Keep detector outputs out of source-writing and approval gates until product owners accept measured limits.

An adapter result would need detector/version, input hash, evaluated language/domain, threshold, calibration reference, timestamp and an explicit abstention outcome. This is a design checklist, not an implemented API.

## Evidence

- [NIST AI 100-4](https://www.nist.gov/publications/reducing-risks-posed-synthetic-content-overview-technical-approaches-digital-content): detection and provenance are distinct methods with different limits.
- [NIST Text 2026](https://ai-challenges.nist.gov/text-2026): ongoing generation/discrimination evaluation; do not describe its evaluation plan as completed results.
- [Liang et al., 2023](https://arxiv.org/abs/2304.02819): observed non-native English false positives in the tested detectors, not a current universal rate.
- [Rivera Soto et al., ACL 2025](https://aclanthology.org/2025.findings-acl.227/): paraphrase robustness and measured improvements in defined settings.

The public [writing-signals guide](../ai-text-signals.md) explains the shipped scope. The detector research plan stays out of the public guide catalogue.
