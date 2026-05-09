import { parseLeadingNumber, groupIdFor, groupLabel } from './grouping.js';
import { getAll, clearStore, put, STORES } from './db.js';

const MAX_REALS_PER_PACKAGE = 10;

// Builds package descriptors from raw images + defaults.
// Returns: [{ groupId, label, defaultIds, realIds }]
export function computePackages(images, defaults) {
  if (!defaults.length || !images.length) return [];

  const buckets = new Map();
  for (const img of images) {
    const n = parseLeadingNumber(img.name);
    if (n === null) continue;
    const g = groupIdFor(n);
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push(img);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);
  const defaultIds = defaults.map((d) => d.id);

  return sortedKeys.map((g) => {
    const reals = buckets.get(g)
      .slice()
      .sort((a, b) => parseLeadingNumber(a.name) - parseLeadingNumber(b.name))
      .slice(0, MAX_REALS_PER_PACKAGE);
    return {
      groupId: g,
      label: groupLabel(g),
      defaultIds: defaultIds.slice(),
      realIds: reals.map((r) => r.id),
    };
  });
}

// Wipes the packages store and rebuilds it from current images + defaults.
export async function rebuildPackagesStore() {
  const [images, defaults] = await Promise.all([
    getAll(STORES.IMAGES),
    getAll(STORES.DEFAULTS),
  ]);
  await clearStore(STORES.PACKAGES);
  const computed = computePackages(images, defaults);
  for (const pkg of computed) {
    await put(STORES.PACKAGES, pkg);
  }
  return computed.length;
}

// Returns hydrated packages with full image objects (defaults + reals).
export async function getHydratedPackages() {
  const [pkgs, images, defaults] = await Promise.all([
    getAll(STORES.PACKAGES),
    getAll(STORES.IMAGES),
    getAll(STORES.DEFAULTS),
  ]);
  const imgMap = new Map(images.map((i) => [i.id, i]));
  const defMap = new Map(defaults.map((d) => [d.id, d]));

  return pkgs
    .sort((a, b) => a.groupId - b.groupId)
    .map((p) => ({
      id: p.id,
      groupId: p.groupId,
      label: p.label,
      defaults: p.defaultIds.map((id) => defMap.get(id)).filter(Boolean),
      reals: p.realIds.map((id) => imgMap.get(id)).filter(Boolean),
      _raw: p,
    }));
}

export async function removeImageFromPackage(packageId, imageId, kind /* 'default' | 'real' */) {
  const all = await getAll(STORES.PACKAGES);
  const pkg = all.find((p) => p.id === packageId);
  if (!pkg) return;
  const field = kind === 'default' ? 'defaultIds' : 'realIds';
  pkg[field] = pkg[field].filter((id) => id !== imageId);
  await put(STORES.PACKAGES, pkg);
}

export function isPackageShareable(pkg) {
  return pkg.defaults.length > 0 && pkg.reals.length > 0;
}
