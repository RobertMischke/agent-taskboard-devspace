// Retain reviewed local measurements for the website; never starts a model.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const read=async file=>fs.readFile(new URL(file,root));
const json=async file=>JSON.parse(await read(file));
const report=await json('test-results/writing-review/report.json');
const models=await json('docs/research/review-model-candidates-2026-09-12.json');
const organizationResearch=await json('docs/research/prompt-organization-sources-2026-09-12.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [file,expected] of [
 ['benchmarks/writing-review/fixtures.json',report.provenance.fixtureSha256],
 ['benchmarks/writing-review/run.mjs',report.provenance.runnerSha256],
 ['packages/writing-rules/dist/index.js',report.provenance.librarySha256]
])if(hash(await read(file))!==expected)throw new Error('Measurement source changed: '+file);
if(!report.execution.offline||report.execution.providerRequestsSent!==0||report.execution.modelResponsesEvaluated!==0)throw new Error('This retention tool accepts only offline measurements.');
const {cases:promptCases,...promptMeasurement}=report.promptMeasurement;
const {cases:surfaceCases,...surfaceEvaluation}=report.surfaceEvaluation;
const data={schemaVersion:1,measuredAt:report.generatedAt,benchmark:report.benchmark,catalogueVersion:report.catalogueVersion,execution:report.execution,provenance:report.provenance,tokenizer:report.tokenizer,promptMeasurement,surfaceEvaluation,modelPricing:models,organizationResearch};
await fs.writeFile(new URL('website/research/review-economics.json',root),JSON.stringify(data,null,2)+'\n');
console.log('Retained matching offline measurement summary and dated model references. Rebuild the website to display it.');
