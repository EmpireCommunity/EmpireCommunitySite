// Workflow hygiene rules of docs/contracts/deploy.md section 3, as pure checks over a parsed workflow.
export type WorkflowFinding = { file: string; message: string };

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { permissions?: unknown; steps?: Step[]; 'timeout-minutes'?: unknown; environment?: unknown };
export type Workflow = { on?: unknown; true?: unknown; permissions?: unknown; jobs?: Record<string, Job> };

const SHA_PINNED = /^[^@\s]+@[0-9a-f]{40}$/;
// Any ${{ }} expression in a shell step that reaches event data (also through functions such as
// fromJSON(toJSON(github.event.x)) or toJSON(github)) is untrusted input: pass it through env instead.
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;
const EVENT_DATA = /\bgithub\s*(?:\.\s*(?:event|head_ref|base_ref|ref(?:_name)?)\b|\[)|\btoJSON\(\s*github\s*\)/i;
const unsafeInRun = (run: string) => [...run.matchAll(EXPRESSION)].some((match) => EVENT_DATA.test(match[1] ?? ''));

export function checkWorkflow(file: string, workflow: Workflow): WorkflowFinding[] {
  const problems: WorkflowFinding[] = [];
  const fail = (message: string) => problems.push({ file, message });

  // A YAML 1.1 parser turns an unquoted `on` key into boolean true (JS key "true"): read it as `on`. With neither key
  // the triggers cannot be checked, so the workflow fails closed.
  const onValue = workflow.on ?? workflow.true;
  const usable = typeof onValue === 'string' || Array.isArray(onValue) || (typeof onValue === 'object' && onValue !== null);
  if (!usable) fail('no usable on key: the triggers cannot be checked');
  const triggers = typeof onValue === 'string' ? [onValue] : Array.isArray(onValue) ? onValue.map(String) : Object.keys((usable ? onValue : {}) as object);
  for (const forbidden of ['pull_request_target', 'workflow_run']) {
    if (triggers.includes(forbidden)) fail(`trigger ${forbidden} is not allowed`);
  }
  if (workflow.permissions === undefined) fail('top-level permissions block is missing');
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    if (job['timeout-minutes'] === undefined) fail(`job ${name}: timeout-minutes is missing`);
    for (const step of job.steps ?? []) {
      if (step.uses !== undefined && !step.uses.startsWith('./') && !SHA_PINNED.test(step.uses)) {
        fail(`job ${name}: ${step.uses} is not pinned to a full commit SHA`);
      }
      if (step.uses?.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) {
        fail(`job ${name}: actions/checkout needs persist-credentials: false`);
      }
      if (step.run !== undefined && unsafeInRun(step.run)) {
        fail(`job ${name}: event data is interpolated into a shell step; pass it through env`);
      }
    }
  }
  return problems;
}
