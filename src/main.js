import { initImagesTab } from './ui/images-tab.js';
import { initPublishTab } from './ui/publish-tab.js';

const tabs = document.querySelectorAll('.tab');
const panels = {
  publish: document.getElementById('publish-panel'),
  images: document.getElementById('images-panel'),
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const which = tab.dataset.tab;
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.entries(panels).forEach(([k, el]) => {
      el.classList.toggle('is-active', k === which);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
});

initImagesTab();
initPublishTab();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => {
      console.warn('SW registration failed', e);
    });
  });
}
