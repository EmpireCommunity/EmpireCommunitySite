// Workflow hygiene rules of docs/contracts/deploy.md section 3, as pure checks over a parsed workflow.
export type WorkflowFinding = { file: string; message: string };

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { permissions?: unknown; steps?: Step[]; 'timeout-minutes'?: unknown; environment?: unknown };
export type Workflow = { on?: unknown; permissions?: unknown; jobs?: Record<string, Job> };

const SHA_PINNED = /^[^@\s]+@[0-9a-f]{40}$/;
// Any ${{ }} expression in a shell step that reaches event data (also through functions such as
// fromJSON(toJSON(github.event.x)) or toJSON(github)) is untrusted input: pass it through env instead.
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;
const EVENT_DATA = /\bgithub\s*(?:\.\s*(?:event|head_ref)\b|\[)|\btoJSON\(\s*github\s*\)/i;
const unsafeInRun = (run: string) => [...run.matchAll(EXPRESSION)].some((match) => EVENT_DATA.test(match[1] ?? ''));

export function checkWorkflow(file: string, workflow: Workflow): WorkflowFinding[] {
  const problems: WorkflowFinding[] = [];
  const fail = (message: string) => problems.push({ file, message });

  const triggers = typeof workflow.on === 'string' ? [workflow.on] : Array.isArray(workflow.on) ? workflow.on.map(String) : Object.keys((workflow.on as object | undefined) ?? {});
  for (const forbidden of ['pull_request_target', 'workflow_run']) {
    if (triggers.includes(forbidden)) fail(`trigger ${forbidden} is not allowed`);
  }
  // ADR-0003: environment secrets are open to any job naming the environment, so only worker-deploy.yml may name it.
  const isWorkerDeploy = /(^|\/)worker-deploy\.ya?ml$/.test(file);
  if (!isWorkerDeploy && JSON.stringify(workflow).includes('worker-production')) {
    fail('only worker-deploy.yml may name the environment worker-production (ADR-0003)');
  }
  if (workflow.permissions === undefined) fail('top-level permissions block is missing');
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    if (job['timeout-minutes'] === undefined) fail(`job ${name}: timeout-minutes is missing`);
    // Fail closed: outside worker-deploy.yml an environment name must be a plain literal, never an expression
    // that could build worker-production at run time.
    const environment = job.environment;
    const environmentName = typeof environment === 'object' && environment !== null ? (environment as { name?: unknown }).name : environment;
    if (!isWorkerDeploy && environment !== undefined && (typeof environmentName !== 'string' || environmentName.includes('${{'))) {
      fail(`job ${name}: dynamic environment name; only literal names are allowed outside worker-deploy.yml`);
    }
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
