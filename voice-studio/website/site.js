let locale='en';
try{if(localStorage.getItem('voice-site:locale')==='de')locale='de'}catch{}
let review;
function setLanguage(value){
  locale=value==='de'?'de':'en';document.documentElement.lang=locale;
  document.querySelectorAll('[data-language]').forEach(el=>{el.hidden=el.dataset.language!==locale});
  document.querySelectorAll('[data-locale]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.locale===locale)));
  document.querySelectorAll('[data-en][data-de]').forEach(el=>el.textContent=el.dataset[locale]);
  try{localStorage.setItem('voice-site:locale',locale)}catch{}
  mountDemo();
}
document.querySelectorAll('[data-locale]').forEach(el=>el.addEventListener('click',()=>setLanguage(el.dataset.locale)));
function mountDemo(){
  review?.dispose();review=undefined;
  const slot=document.querySelector(`[data-language="${locale}"] [data-demo-slot]`);if(!slot||!window.VoiceReview)return;
  const de=locale==='de';slot.innerHTML='';
  const root=document.createElement('section');root.className='demo';root.setAttribute('aria-label',de?'Library-Beispiel':'Library demonstration');
  root.innerHTML=`<div class="demo-controls"><label><input type="checkbox" checked data-marks> ${de?'Markierungen anzeigen':'Show marks'}</label><small>${de?'Vorgegebener Beispielbefund':'Supplied example finding'}</small></div><div class="demo-text" data-demo-text><p data-voice-unit="intro" lang="en">Our powerful tools keep review decisions beside the source.</p></div><div class="demo-findings"><button type="button">${de?'Befund: Welche konkrete Fähigkeit bedeutet „powerful“ hier?':'Finding: Which specific capability does “powerful” describe here?'}</button></div><output class="demo-output" aria-live="polite">${de?'Text im Beispiel auswählen.':'Select text in the example.'}</output><p class="demo-status" role="status"></p>`;
  slot.append(root);const textRoot=root.querySelector('[data-demo-text]');const text=textRoot.textContent;
  const finding={id:'example-capability',ruleId:'example.wording',category:'wording',severity:'info',message:'Describe the capability.',explanation:'This is a supplied demonstration finding, not an analyzer verdict.',quote:'powerful',unitId:'intro',start:4,end:12,suggestion:null,engine:'example'};
  review=VoiceReview.mountVoiceReview({root:textRoot,units:[{id:'intro',text,kind:'paragraph',language:'en',sourceSpan:{start:0,end:text.length,encoding:'utf16'}}],findings:[finding],feedback:[],onSelect:selection=>{root.querySelector('output').textContent=JSON.stringify(selection,null,2)},onFindingSelect:()=>{root.querySelector('output').textContent=de?'Beispielhinweis: Eine konkrete Fähigkeit könnte hilfreicher sein. Der Seitenkontext entscheidet.':'Example prompt: a specific capability may be more useful. The page context determines whether to change it.'}});
  root.querySelector('[data-marks]').addEventListener('change',event=>{review.update({findings:event.target.checked?[finding]:[],feedback:[]});root.querySelector('.demo-status').textContent=event.target.checked?(de?'Markierungen sichtbar.':'Marks visible.'):(de?'Markierungen ausgeblendet.':'Marks hidden.')});
  root.querySelector('button').addEventListener('click',()=>review.selectFinding(finding.id));
}
setLanguage(locale);

// Guide navigation stays compact on small screens; native details also work without JS.
const guideMenu=document.querySelector('.guide-menu');
if(guideMenu&&matchMedia('(max-width:760px)').matches)guideMenu.open=false;
document.querySelectorAll('.copy-code').forEach(button=>{
  button.hidden=false;
  button.addEventListener('click',async()=>{
    const code=button.closest('.code-block')?.querySelector('code');if(!code)return;
    try{await navigator.clipboard.writeText(code.textContent);button.textContent=locale==='de'?'Kopiert':'Copied';}
    catch{const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);button.textContent=locale==='de'?'Text ausgewählt':'Text selected';}
    setTimeout(()=>button.textContent=locale==='de'?'Kopieren':'Copy',2000);
  });
});
if('IntersectionObserver' in window){
  const sectionLinks=document.querySelectorAll('.page-outline a');
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){sectionLinks.forEach(a=>{if(a.hash==='#'+entry.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});}},{rootMargin:'-5% 0px -70% 0px'});
  document.querySelectorAll('.guide-content h2').forEach(el=>observer.observe(el));
}

// JSON remains a normal link without JavaScript; enhanced views stay on this page.
import('./json-viewer.js').then(module=>module.installJsonViewer()).catch(()=>{});
