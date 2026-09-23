export function evaluateSeededDefects(seeds = [], observedFindings = []) {
  const detectedIds = new Set();
  for (const seed of seeds) {
    const match = observedFindings.some(
      (finding) =>
        finding.owner === seed.owner &&
        finding.category === seed.category &&
        (finding.id === seed.id ||
          (seed.evidenceIncludes && finding.evidence.toLowerCase().includes(seed.evidenceIncludes.toLowerCase()))),
    );
    if (match) detectedIds.add(seed.id);
  }
  const missed = seeds.filter((seed) => !detectedIds.has(seed.id)).map((seed) => seed.id);
  return {
    seeded: seeds.length,
    detected: seeds.length - missed.length,
    missed,
    catchRate: seeds.length === 0 ? 1 : (seeds.length - missed.length) / seeds.length,
  };
}
