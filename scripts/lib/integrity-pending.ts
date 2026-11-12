// Operational targets, separate from scaffold flags in pending.ts. The launch PR flips both to false (D-65).
// The already-live Worker has no deferral flag.
export const INTEGRITY_PENDING = {
  site: false,
  root: false,
} as const;
