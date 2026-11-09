// Workflow hygiene rules of docs/contracts/deploy.md section 3, as pure checks over a parsed workflow.
export type WorkflowFinding = { file: string; message: string };

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { permissions?: unknown; steps?: Step[]; 'timeout-minutes'?: unknown };
export type Workflow = { on?: unknown; permissions?: unknown; jobs?: Record<string, Job> };

const SHA_PINNED = /^[^@\s]+@[0-9a-f]{40}$/;
// Expressions built from attacker-controllable event data must never be interpolated into a shell step.
const UNSAFE_IN_RUN = /\$\{\{\s*(?:github\.(?:event\.(?:issue|pull_request|comment|review|head_commit|commits|pages|discussion)|head_ref)|github\.event\.workflow_run\.head_)/;

export function checkWorkflow(file: string, workflow: Workflow): WorkflowFinding[] {
  const problems: WorkflowFinding[] = [];
  const fail = (message: string) => problems.push({ file, message });

  const triggers = typeof workflow.on === 'string' ? [workflow.on] : Object.keys((workflow.on as object | undefined) ?? {});
  for (const forbidden of ['pull_request_target', 'workflow_run']) {
    if (triggers.includes(forbidden)) fail(`trigger ${forbidden} is not allowed`);
  }
  // ADR-0003: environment secrets are open to any job naming the environment, so only worker-deploy.yml may name it.
  if (!/(^|\/)worker-deploy\.ya?ml$/.test(file) && JSON.stringify(workflow).includes('worker-production')) {
    fail('only worker-deploy.yml may name the environment worker-production (ADR-0003)');
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
      if (step.run !== undefined && UNSAFE_IN_RUN.test(step.run)) {
        fail(`job ${name}: event data is interpolated into a shell step; pass it through env`);
      }
    }
  }
  return problems;
}
