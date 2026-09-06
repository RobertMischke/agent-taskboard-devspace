# Developer handbook.

This handbook is a Markdown example for Voice Studio. Its paragraphs include
deliberate review findings so the workflow can be exercised locally.

## Getting started.

Our powerful system makes every task effortless. Open a file, inspect its
findings and save feedback on the words that need attention.

This page describes what exists.

## Preserve document structure

Read the [review guide](./review-guide.md) before applying an edit. **Important formatting** and link destinations must survive wording changes.

- Select a phrase and explain the problem.
- Inspect the proposed source diff.
- Apply the edit and verify the rendered document.

Do not analyze or rewrite code merely because it contains a flagged word:

```js
const message = 'powerful seamless robust';
console.log(message);
```

The inline example `seamless()` is also code. A Unicode example 🧪 verifies
that selections and source offsets stay aligned.
