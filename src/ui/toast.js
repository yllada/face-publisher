const el = document.getElementById('toast');
let timer;

export function showToast(msg, duration = 1800) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), duration);
}
