import { getState, setState } from '../core/db.js';
import {
  getHydratedPackages,
  removeImageFromPackage,
  isPackageShareable,
} from '../core/packages.js';
import { subscribe, emit } from '../core/store.js';
import { showToast } from './toast.js';
import { confirmDialog } from './confirm.js';

const elCurrent = document.getElementById('pkg-current');
const elTotal = document.getElementById('pkg-total');
const elChip = document.getElementById('status-chip');
const elStatusLabel = document.getElementById('status-label');
const elPreview = document.getElementById('preview');
const elEmpty = document.getElementById('empty-state');
const elPkgHead = document.querySelector('.package-head');
const elSharedCount = document.getElementById('shared-count');
const elSharedTotal = document.getElementById('shared-total');
const elProgressFill = document.getElementById('progress-fill');
const elProgressTrack = document.getElementById('progress-track');
const btnShare = document.getElementById('btn-share');
const btnNext = document.getElementById('btn-next');

const SHARED_KEY = 'sharedIds';
const SHARE_FILE_CAP = 10;

const blobUrls = new Set();
function makeUrl(blob) {
  const u = URL.createObjectURL(blob);
  blobUrls.add(u);
  return u;
}
function revokeAll() {
  for (const u of blobUrls) URL.revokeObjectURL(u);
  blobUrls.clear();
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgUse(id, size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

let packages = [];
let currentIndex = 0;
let sharedIds = new Set();

async function loadState() {
  packages = await getHydratedPackages();
  const savedShared = await getState(SHARED_KEY, []);
  sharedIds = new Set(Array.isArray(savedShared) ? savedShared : []);
  if (packages.length === 0) {
    currentIndex = 0;
  } else {
    const saved = await getState('currentIndex', 0);
    currentIndex = Math.min(Math.max(0, saved | 0), packages.length - 1);
  }
}

async function persistShared() {
  await setState(SHARED_KEY, Array.from(sharedIds));
}

function setChipState(state, label) {
  elChip.dataset.state = state;
  elStatusLabel.textContent = label;
}

function updateProgress() {
  const total = packages.length;
  const validShared = Array.from(sharedIds).filter((id) =>
    packages.some((p) => p.id === id),
  ).length;
  elSharedCount.textContent = String(validShared);
  elSharedTotal.textContent = String(total);
  const pct = total === 0 ? 0 : Math.round((validShared / total) * 100);
  elProgressFill.style.width = `${pct}%`;
  elProgressTrack.setAttribute('aria-valuenow', String(pct));
}

function renderPreviewItems(pkg) {
  elPreview.innerHTML = '';
  const items = [
    ...pkg.defaults.map((d) => ({ ...d, _kind: 'default' })),
    ...pkg.reals.map((r) => ({ ...r, _kind: 'real' })),
  ];
  items.forEach((it) => {
    const div = document.createElement('div');
    div.className = 'item';
    const img = document.createElement('img');
    img.src = makeUrl(it.blob);
    img.alt = it.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    div.appendChild(img);

    if (it._kind === 'default') {
      const badge = document.createElement('div');
      badge.className = 'badge-default';
      badge.setAttribute('aria-label', 'Imagen por defecto');
      badge.appendChild(svgUse('i-star', 12));
      div.appendChild(badge);
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.setAttribute('aria-label', `Quitar ${it.name}`);
    del.appendChild(svgUse('i-x', 16));
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({
        title: 'Quitar imagen',
        message: `¿Quitar "${it.name}" de este paquete?`,
        confirmText: 'Quitar',
        cancelText: 'Cancelar',
        destructive: true,
      });
      if (!ok) return;
      await removeImageFromPackage(pkg.id, it.id, it._kind);
      await refresh();
      emit();
    });
    div.appendChild(del);
    elPreview.appendChild(div);
  });
}

function render() {
  revokeAll();
  updateProgress();

  if (packages.length === 0) {
    elCurrent.textContent = '—';
    elTotal.textContent = '—';
    setChipState('empty', 'Sin paquetes');
    elPreview.innerHTML = '';
    elEmpty.hidden = false;
    if (elPkgHead) elPkgHead.hidden = true;
    btnShare.disabled = true;
    btnNext.disabled = true;
    return;
  }

  elEmpty.hidden = true;
  if (elPkgHead) elPkgHead.hidden = false;
  const pkg = packages[currentIndex];
  elCurrent.textContent = String(currentIndex + 1);
  elTotal.textContent = String(packages.length);

  const shareable = isPackageShareable(pkg);
  const wasShared = sharedIds.has(pkg.id);

  if (wasShared) {
    setChipState('shared', `Grupo ${pkg.label} · Compartido`);
  } else if (shareable) {
    setChipState(
      'ready',
      `Grupo ${pkg.label} · ${pkg.defaults.length}+${pkg.reals.length}`,
    );
  } else {
    setChipState('incomplete', `Grupo ${pkg.label} · incompleto`);
  }

  renderPreviewItems(pkg);

  btnShare.disabled = !shareable;
  btnNext.disabled = packages.length <= 1;
}

async function nextPackage() {
  if (packages.length === 0) return;
  currentIndex = (currentIndex + 1) % packages.length;
  await setState('currentIndex', currentIndex);
  render();
}

function buildFiles(pkg) {
  const stamped = [
    ...pkg.defaults.map((d) => ({ ...d, _kind: 'default' })),
    ...pkg.reals.map((r) => ({ ...r, _kind: 'real' })),
  ];
  const limited = stamped.slice(0, SHARE_FILE_CAP);
  return limited.map((it, i) => {
    const type = it.blob.type || 'image/jpeg';
    const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] || 'jpg');
    const stem = (it.name || `img_${i}`).replace(/\.[a-z0-9]+$/i, '') || `img_${i}`;
    const baseName = `${stem}.${ext}`;
    return new File([it.blob], baseName, { type });
  });
}

function reportError(stage, err) {
  console.error(`[share:${stage}]`, err);
  const name = (err && err.name) || 'Error';
  const msg = (err && err.message) || '';
  const text = `${stage} → ${name}${msg ? ': ' + msg.slice(0, 80) : ''}`;
  setChipState('error', text);
  showToast(text, 5000);
}

async function sharePackage() {
  const pkg = packages[currentIndex];
  if (!pkg) return;
  if (!isPackageShareable(pkg)) {
    showToast('Paquete incompleto');
    return;
  }
  if (typeof navigator.share !== 'function') {
    reportError('no-api', new Error('navigator.share no existe'));
    return;
  }

  const files = buildFiles(pkg);
  const truncated = pkg.defaults.length + pkg.reals.length > SHARE_FILE_CAP;

  if (typeof navigator.canShare !== 'function') {
    reportError('no-canShare', new Error('canShare no soportado'));
    return;
  }
  if (!navigator.canShare({ files })) {
    reportError('canShare-false', new Error(`canShare rechazó ${files.length} archivos`));
    return;
  }

  setChipState(
    'sharing',
    `Compartiendo ${files.length} archivo${files.length === 1 ? '' : 's'}…`,
  );
  btnShare.disabled = true;

  try {
    await navigator.share({ files });
    sharedIds.add(pkg.id);
    await persistShared();
    updateProgress();
    setChipState(
      'shared',
      truncated
        ? `Compartido (${SHARE_FILE_CAP} de ${pkg.defaults.length + pkg.reals.length})`
        : `Grupo ${pkg.label} · Compartido`,
    );
    btnShare.disabled = false;
  } catch (e) {
    btnShare.disabled = false;
    if (e && e.name === 'AbortError') {
      setChipState(
        sharedIds.has(pkg.id) ? 'shared' : 'ready',
        sharedIds.has(pkg.id)
          ? `Grupo ${pkg.label} · Compartido`
          : `Grupo ${pkg.label} · ${pkg.defaults.length}+${pkg.reals.length}`,
      );
      return;
    }
    reportError('share', e);
  }
}

btnNext.addEventListener('click', nextPackage);
btnShare.addEventListener('click', sharePackage);

export async function refresh() {
  await loadState();
  render();
}

export async function initPublishTab() {
  subscribe(refresh);
  await refresh();
}
