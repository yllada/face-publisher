import {
  getHydratedPackages,
  removeImageFromPackage,
} from '../core/packages.js';
import { subscribe, emit } from '../core/store.js';
import { confirmDialog } from './confirm.js';

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

function render(packages) {
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
      ph.className = 'ph';
      const img = document.createElement('img');
      img.src = makeUrl(it.blob);
      img.alt = it.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      ph.appendChild(img);

      if (it._kind === 'default') {
        const badge = document.createElement('div');
        badge.className = 'badge-default';
        badge.setAttribute('aria-label', 'Imagen por defecto');
        badge.appendChild(svgUse('i-star', 8));
        ph.appendChild(badge);
      }

      const x = document.createElement('div');
      x.className = 'x';
      x.appendChild(svgUse('i-x', 18));
      ph.appendChild(x);

      ph.addEventListener('click', async () => {
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
      grid.appendChild(ph);
    });

    wrap.appendChild(grid);
    pkgList.appendChild(wrap);
  });
}

export async function refresh() {
  revokeAll();
  const packages = await getHydratedPackages();
  render(packages);
}

export function initPackagesTab() {
  subscribe(refresh);
  refresh();
}
