// Cross-entry rule for team data (docs/contracts/site-data.md section 9): at most one founder.
export function assertSingleFounder(entries: readonly unknown[]): void {
  const founders = entries.filter(
    (entry) => typeof entry === 'object' && entry !== null && 'isFounder' in entry && entry.isFounder === true,
  );
  if (founders.length > 1) {
    throw new Error(`team.yaml: at most one entry may set isFounder, found ${founders.length}`);
  }
}
