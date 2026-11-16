// Workflow hygiene check (docs/contracts/deploy.md section 3). Usage: node scripts/check-workflows.ts
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkBuildkitPin, checkWorkflow, trackerRefs, type Workflow } from './lib/workflow-rules.ts';

const dir = '.github/workflows';
const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
const tracked = trackerRefs(readFileSync('.github/buildkit/Dockerfile', 'utf8'));
const problems = files.flatMap((name) => {
  const workflow = parse(readFileSync(`${dir}/${name}`, 'utf8')) as Workflow;
  return [...checkWorkflow(`${dir}/${name}`, workflow), ...checkBuildkitPin(`${dir}/${name}`, workflow, tracked)];
});

for (const problem of problems) console.log(`::error file=${problem.file}::${problem.message}`);
console.log(`check-workflows: ${files.length} workflow(s), ${problems.length} problem(s).`);
process.exit(problems.length > 0 ? 1 : 0);
