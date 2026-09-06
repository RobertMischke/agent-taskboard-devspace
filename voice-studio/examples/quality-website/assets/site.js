// Native website behaviour. Voice Studio observes this running page; it does not recreate it.
const menu = document.querySelector('.menu-toggle');
menu?.addEventListener('click', () => {
  const open = document.querySelector('.site-nav')?.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(!!open));
});
for (const input of document.querySelectorAll('[data-checklist]')) {
  const key = 'quality-example:check:' + input.dataset.checklist;
  input.checked = localStorage.getItem(key) === 'yes';
  input.addEventListener('change', () => localStorage.setItem(key, input.checked ? 'yes' : 'no'));
}
const draft = document.querySelector('#contact-draft');
draft?.addEventListener('submit', event => {
  event.preventDefault();
  const result = document.querySelector('#contact-result');
  result.hidden = false;
  result.textContent = 'Entwurf lokal erstellt. Diese Beispielwebsite verschickt keine Nachrichten. Thema: ' + new FormData(draft).get('subject');
});
const studioOrigins = ['http://127.0.0.1:5188', 'http://localhost:5188', 'http://127.0.0.1:4188', 'http://localhost:4188'];
const requestedStudio = new URLSearchParams(location.search).get('voice-studio-origin');
if (studioOrigins.includes(requestedStudio)) localStorage.setItem('quality-example:studio-origin', requestedStudio);
const rememberedStudio = localStorage.getItem('quality-example:studio-origin');
const studioOrigin = studioOrigins.includes(rememberedStudio) ? rememberedStudio : 'http://127.0.0.1:5188';
if (window.VoiceReview) window.VoiceReview.connectVoiceStudio({ studioOrigin });
