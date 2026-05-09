import {
  add, getAll, clearStore, setState, STORES,
} from '../core/db.js';

async function resetCurrentIndex() {
  await setState('currentIndex', 0);
}
import { resizeImage } from '../core/resize.js';
import {
  rebuildPackagesStore,
  getHydratedPackages,
  removeImageFromPackage,
} from '../core/packages.js';
import { emit } from '../core/store.js';
import { showToast } from './toast.js';

const inputDefaults = document.getElementById('upload-defaults');
const inputImages = document.getElementById('upload-images');
const btnResetDefaults = document.getElementById('reset-defaults');
const btnResetImages = document.getElementById('reset-images');
const gridDefaults = document.getElementById('defaults-grid');
const gridImages = document.getElementById('images-grid');
const pkgList = document.getElementById('packages-list');

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
  if (!confirm('¿Eliminar todas las imágenes por defecto?')) return;
  await clearStore(STORES.DEFAULTS);
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast('Defaults eliminadas');
  await refresh();
  emit();
});

btnResetImages.addEventListener('click', async () => {
  if (!confirm('¿Eliminar todas las imágenes?')) return;
  await clearStore(STORES.IMAGES);
  await rebuildPackagesStore();
  await resetCurrentIndex();
  showToast('Imágenes eliminadas');
  await refresh();
  emit();
});

function renderGrid(grid, items) {
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
    div.appendChild(img);
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = it.name;
    div.appendChild(name);
    grid.appendChild(div);
  }
}

function renderPackages(packages) {
  pkgList.innerHTML = '';
  if (!packages.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Sin paquetes. Necesitás defaults + imágenes con número.';
    pkgList.appendChild(empty);
    return;
  }
  packages.forEach((pkg, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'pkg';
    wrap.dataset.id = pkg.id;

    const head = document.createElement('div');
    head.className = 'pkg-head';
    head.innerHTML = `
      <strong>#${idx + 1} · ${pkg.label}</strong>
      <span class="badge">${pkg.defaults.length} default · ${pkg.reals.length} reales</span>
    `;
    wrap.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'pkg-grid';

    const items = [
      ...pkg.defaults.map((d) => ({ ...d, _kind: 'default' })),
      ...pkg.reals.map((r) => ({ ...r, _kind: 'real' })),
    ];

    items.forEach((it) => {
      const ph = document.createElement('div');
      ph.className = 'ph' + (it._kind === 'default' ? ' is-default' : '');
      const img = document.createElement('img');
      img.src = makeUrl(it.blob);
      ph.appendChild(img);
      const x = document.createElement('div');
      x.className = 'x';
      x.textContent = '×';
      ph.appendChild(x);

      ph.addEventListener('click', async () => {
        if (!confirm(`¿Quitar "${it.name}" de este paquete?`)) return;
        await removeImageFromPackage(pkg.id, it.id, it._kind);
        await refresh();
        emit();
      });
      grid.appendChild(ph);
    });

    wrap.appendChild(grid);
    pkgList.appendChild(wrap);
  });
}

export async function refresh() {
  revokeAll();
  const [defaults, images, packages] = await Promise.all([
    getAll(STORES.DEFAULTS),
    getAll(STORES.IMAGES),
    getHydratedPackages(),
  ]);
  renderGrid(gridDefaults, defaults);
  renderGrid(gridImages, images);
  renderPackages(packages);
}

export function initImagesTab() {
  refresh();
}
