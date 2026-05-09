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

async function ingestFiles(files, store) {
  if (!files || !files.length) return 0;
  showToast(`Procesando ${files.length}…`);
  let added = 0;
  for (const file of files) {
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
      console.error('resize failed', file.name, e);
    }
  }
  return added;
}

inputDefaults.addEventListener('change', async (e) => {
  const n = await ingestFiles(e.target.files, STORES.DEFAULTS);
  inputDefaults.value = '';
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast(`${n} default${n === 1 ? '' : 's'} agregada${n === 1 ? '' : 's'}`);
  await refresh();
  emit();
});

inputImages.addEventListener('change', async (e) => {
  const n = await ingestFiles(e.target.files, STORES.IMAGES);
  inputImages.value = '';
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast(`${n} imagen${n === 1 ? '' : 'es'} agregada${n === 1 ? '' : 's'}`);
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
