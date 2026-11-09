// Workflow hygiene check (docs/contracts/deploy.md section 3). Usage: node scripts/check-workflows.ts
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkWorkflow, type Workflow } from './lib/workflow-rules.ts';

const dir = '.github/workflows';
const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
const problems = files.flatMap((name) => checkWorkflow(`${dir}/${name}`, parse(readFileSync(`${dir}/${name}`, 'utf8')) as Workflow));

for (const problem of problems) console.log(`::error file=${problem.file}::${problem.message}`);
console.log(`check-workflows: ${files.length} workflow(s), ${problems.length} problem(s).`);
process.exit(problems.length > 0 ? 1 : 0);
