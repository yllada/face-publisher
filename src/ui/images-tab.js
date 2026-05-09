import {
  add, getAll, clearStore, deleteRecord, setState, STORES,
} from '../core/db.js';

async function resetCurrentIndex() {
  await setState('currentIndex', 0);
}
import { resizeImage } from '../core/resize.js';
import { rebuildPackagesStore } from '../core/packages.js';
import { subscribe, emit } from '../core/store.js';
import { showToast } from './toast.js';
import { confirmDialog } from './confirm.js';

const inputDefaults = document.getElementById('upload-defaults');
const inputImages = document.getElementById('upload-images');
const btnResetDefaults = document.getElementById('reset-defaults');
const btnResetImages = document.getElementById('reset-images');
const gridDefaults = document.getElementById('defaults-grid');
const gridImages = document.getElementById('images-grid');

const labelDefaults = inputDefaults.closest('label');
const labelImages = inputImages.closest('label');

const elProgress = document.getElementById('upload-progress');
const elProgTitle = document.getElementById('upload-progress-title');
const elProgFill = document.getElementById('upload-progress-fill');
const elProgTrack = document.getElementById('upload-progress-track');
const elProgCount = document.getElementById('upload-progress-count');
const elProgCurrent = document.getElementById('upload-progress-current');
const btnUploadCancel = document.getElementById('upload-cancel');

let cancelRequested = false;
btnUploadCancel.addEventListener('click', () => {
  cancelRequested = true;
  btnUploadCancel.disabled = true;
  btnUploadCancel.textContent = 'Cancelando…';
});

function setUploadDisabled(disabled) {
  for (const lbl of [labelDefaults, labelImages]) {
    if (lbl) lbl.setAttribute('aria-disabled', String(disabled));
  }
  btnResetDefaults.disabled = disabled;
  btnResetImages.disabled = disabled;
}

function showProgress(kind, total) {
  elProgTitle.textContent = kind === 'defaults' ? 'Procesando defaults' : 'Procesando imágenes';
  elProgCount.textContent = `0 / ${total}`;
  elProgCurrent.textContent = '';
  elProgFill.style.width = '0%';
  elProgTrack.setAttribute('aria-valuenow', '0');
  btnUploadCancel.disabled = false;
  btnUploadCancel.textContent = 'Cancelar';
  elProgress.hidden = false;
}

function updateProgress(done, total, currentName) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  elProgCount.textContent = `${done} / ${total}`;
  elProgCurrent.textContent = currentName || '';
  elProgFill.style.width = `${pct}%`;
  elProgTrack.setAttribute('aria-valuenow', String(pct));
}

function hideProgress() {
  elProgress.hidden = true;
}

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

async function ingestFiles(files, store, kind) {
  if (!files || !files.length) return { added: 0, cancelled: false, failed: 0 };

  cancelRequested = false;
  setUploadDisabled(true);
  showProgress(kind, files.length);

  let added = 0;
  let failed = 0;
  let i = 0;

  for (const file of files) {
    if (cancelRequested) break;
    updateProgress(i, files.length, file.name);
    try {
      const blob = await resizeImage(file);
      await add(store, {
        name: file.name,
        blob,
        size: blob.size,
        addedAt: Date.now(),
      });
      added++;
    } catch (e) {
      failed++;
      console.error('resize failed', file.name, e);
    }
    i++;
    updateProgress(i, files.length, file.name);
  }

  hideProgress();
  setUploadDisabled(false);
  return { added, cancelled: cancelRequested, failed };
}

function summaryToast(kind, { added, cancelled, failed }) {
  const noun = kind === 'defaults'
    ? (added === 1 ? 'default' : 'defaults')
    : (added === 1 ? 'imagen' : 'imágenes');
  const verb = added === 1 ? 'agregada' : 'agregadas';
  let msg = `${added} ${noun} ${verb}`;
  if (failed > 0) msg += ` · ${failed} con error`;
  if (cancelled) msg = `Cancelado · ${msg}`;
  showToast(msg, cancelled || failed ? 3000 : 1800);
}

inputDefaults.addEventListener('change', async (e) => {
  const result = await ingestFiles(e.target.files, STORES.DEFAULTS, 'defaults');
  inputDefaults.value = '';
  await rebuildPackagesStore();
  await resetCurrentIndex();
  summaryToast('defaults', result);
  await refresh();
  emit();
});

inputImages.addEventListener('change', async (e) => {
  const result = await ingestFiles(e.target.files, STORES.IMAGES, 'images');
  inputImages.value = '';
  await rebuildPackagesStore();
  await resetCurrentIndex();
  summaryToast('images', result);
  await refresh();
  emit();
});

btnResetDefaults.addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Eliminar imágenes por defecto',
    message: 'Se borrarán todas las imágenes por defecto y se reconstruirán los paquetes. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar todo',
    cancelText: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  await clearStore(STORES.DEFAULTS);
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast('Defaults eliminadas');
  await refresh();
  emit();
});

btnResetImages.addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Eliminar imágenes',
    message: 'Se borrarán todas las imágenes numeradas y se reconstruirán los paquetes. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar todo',
    cancelText: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;
  await clearStore(STORES.IMAGES);
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast('Imágenes eliminadas');
  await refresh();
  emit();
});

function renderGrid(grid, items, store) {
  grid.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.gridColumn = '1 / -1';
    empty.textContent = 'Vacío';
    grid.appendChild(empty);
    return;
  }
  for (const it of items) {
    const div = document.createElement('div');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = makeUrl(it.blob);
    img.alt = it.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    div.appendChild(img);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = it.name;
    div.appendChild(name);

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.setAttribute('aria-label', `Eliminar ${it.name}`);
    del.appendChild(svgUse('i-x', 16));
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({
        title: 'Eliminar imagen',
        message: `¿Eliminar "${it.name}"? Se reconstruirán los paquetes.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        destructive: true,
      });
      if (!ok) return;
      await deleteRecord(store, it.id);
      await rebuildPackagesStore();
      await resetCurrentIndex();
      showToast('Imagen eliminada');
      await refresh();
      emit();
    });
    div.appendChild(del);

    grid.appendChild(div);
  }
}

export async function refresh() {
  revokeAll();
  const [defaults, images] = await Promise.all([
    getAll(STORES.DEFAULTS),
    getAll(STORES.IMAGES),
  ]);
  renderGrid(gridDefaults, defaults, STORES.DEFAULTS);
  renderGrid(gridImages, images, STORES.IMAGES);
}

export function initImagesTab() {
  subscribe(refresh);
  refresh();
}
