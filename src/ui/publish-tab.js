import { getState, setState } from '../core/db.js';
import {
  getHydratedPackages,
  removeImageFromPackage,
  isPackageShareable,
} from '../core/packages.js';
import { subscribe, emit } from '../core/store.js';
import { showToast } from './toast.js';

const elCurrent = document.getElementById('pkg-current');
const elTotal = document.getElementById('pkg-total');
const elStatus = document.getElementById('pkg-status');
const elPreview = document.getElementById('preview');
const btnShare = document.getElementById('btn-share');
const btnNext = document.getElementById('btn-next');

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

let packages = [];
let currentIndex = 0;

async function loadState() {
  packages = await getHydratedPackages();
  if (packages.length === 0) {
    currentIndex = 0;
  } else {
    const saved = await getState('currentIndex', 0);
    currentIndex = Math.min(Math.max(0, saved | 0), packages.length - 1);
  }
}

function render() {
  revokeAll();

  if (packages.length === 0) {
    elCurrent.textContent = '—';
    elTotal.textContent = '—';
    elStatus.textContent = 'Sin paquetes';
    elPreview.innerHTML = '';
    btnShare.disabled = true;
    btnNext.disabled = true;
    return;
  }

  const pkg = packages[currentIndex];
  elCurrent.textContent = String(currentIndex + 1);
  elTotal.textContent = String(packages.length);
  const shareable = isPackageShareable(pkg);
  elStatus.textContent = shareable
    ? `Grupo ${pkg.label} · ${pkg.defaults.length}+${pkg.reals.length}`
    : `Grupo ${pkg.label} · incompleto`;

  elPreview.innerHTML = '';
  const items = [
    ...pkg.defaults.map((d) => ({ ...d, _kind: 'default' })),
    ...pkg.reals.map((r) => ({ ...r, _kind: 'real' })),
  ];
  items.forEach((it) => {
    const div = document.createElement('div');
    div.className = 'item' + (it._kind === 'default' ? ' is-default' : '');
    const img = document.createElement('img');
    img.src = makeUrl(it.blob);
    img.alt = it.name;
    div.appendChild(img);
    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', `Quitar ${it.name}`);
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`¿Quitar "${it.name}" de este paquete?`)) return;
      await removeImageFromPackage(pkg.id, it.id, it._kind);
      await refresh();
      emit();
    });
    div.appendChild(del);
    elPreview.appendChild(div);
  });

  btnShare.disabled = !shareable;
  btnNext.disabled = packages.length === 0;
}

async function nextPackage() {
  if (packages.length === 0) return;
  currentIndex = (currentIndex + 1) % packages.length;
  await setState('currentIndex', currentIndex);
  render();
}

function buildFiles(pkg) {
  const items = [...pkg.defaults, ...pkg.reals];
  return items.map((it, i) => {
    const type = it.blob.type || 'image/jpeg';
    const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] || 'jpg');
    const stem = (it.name || `img_${i}`).replace(/\.[a-z0-9]+$/i, '') || `img_${i}`;
    const baseName = `${stem}.${ext}`;
    return new File([it.blob], baseName, { type });
  });
}

async function tryShare(files) {
  if (!navigator.canShare || !navigator.canShare({ files })) return false;
  await navigator.share({ files });
  return true;
}

async function sharePackage() {
  const pkg = packages[currentIndex];
  if (!pkg) return;
  if (!isPackageShareable(pkg)) {
    showToast('Paquete incompleto');
    return;
  }
  if (typeof navigator.share !== 'function') {
    showToast('Compartir no soportado en este navegador');
    return;
  }

  const files = buildFiles(pkg);

  try {
    if (await tryShare(files)) return;
    showToast('Este dispositivo no acepta los archivos');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.error('share failed', e);
    const name = (e && e.name) || 'Error';
    const msg = (e && e.message) || '';
    showToast(`${name}${msg ? ': ' + msg.slice(0, 60) : ''}`, 4000);
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
