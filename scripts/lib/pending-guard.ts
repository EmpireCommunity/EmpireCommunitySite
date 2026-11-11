// Release guard decision (pure). Which pending flags block a tag: every flag that is not exactly false, except that a
// release candidate (vX.Y.Z-rc.N) does not wait for the legal pages, which land in the launch PR (D-65). Nothing else
// is ignored among scaffold flags, and a final tag ignores nothing.
export const PRERELEASE_IGNORED_FLAGS: readonly string[] = ['legalPages'];

export function blockingFlags(pending: Readonly<Record<string, unknown>>, prerelease: boolean): string[] {
  return Object.entries(pending)
    .filter(([name, value]) => value !== false && !(prerelease && PRERELEASE_IGNORED_FLAGS.includes(name)))
    .map(([name]) => name);
}

// Operational launch flags apply only to final releases; rehearsal tags keep their existing scaffold checks.
export function blockingIntegrityFlags(pending: Readonly<Record<string, unknown>>, prerelease: boolean): string[] {
  return prerelease ? [] : blockingFlags(pending, false);
}
