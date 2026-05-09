export function parseLeadingNumber(name) {
  const m = String(name).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function groupIdFor(num) {
  return Math.floor(num / 10);
}

export function groupLabel(groupId) {
  const lo = String(groupId * 10).padStart(2, '0');
  const hi = String(groupId * 10 + 9).padStart(2, '0');
  return `${lo}–${hi}`;
}
