function revealResearchNote() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement && target.classList.contains('research-entry')) target.open = true;
}
window.addEventListener('hashchange', revealResearchNote);
document.addEventListener('click', event => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  if (link && link.hash === location.hash) revealResearchNote();
});
revealResearchNote();
