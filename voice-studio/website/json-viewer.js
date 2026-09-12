// Public documentation records only. The Studio API and session are never involved.
export function installJsonViewer(root=document) {
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./json-viewer.css',import.meta.url).href;document.head.append(style);
  const locale=()=>document.documentElement.lang==='de'?'de':'en';
  const message=(en,de)=>locale()==='de'?de:en;
  const maximumBytes=2*1024*1024;
  let dialog,heading,filename,status,code,retry,closeButton,controller,returnFocus,activeUrl,sequence=0;

  function recordUrl(link){
    if(link.hasAttribute('download'))return null;
    try{const url=new URL(link.href,location.href);return url.origin===location.origin&&/^https?:$/.test(url.protocol)&&url.pathname.toLowerCase().endsWith('.json')&&!url.username&&!url.password?url:null}catch{return null}
  }
  function createDialog(){
    dialog=document.createElement('dialog');dialog.className='json-viewer';dialog.setAttribute('aria-labelledby','json-viewer-title');
    const header=document.createElement('header');header.className='json-viewer-header';
    const title=document.createElement('div');heading=document.createElement('h2');heading.id='json-viewer-title';
    filename=document.createElement('p');filename.className='json-viewer-filename';title.append(heading,filename);
    closeButton=document.createElement('button');closeButton.type='button';closeButton.className='json-viewer-close';closeButton.autofocus=true;
    closeButton.addEventListener('click',()=>dialog.close());header.append(title,closeButton);
    status=document.createElement('p');status.className='json-viewer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    retry=document.createElement('button');retry.type='button';retry.className='json-viewer-retry';retry.hidden=true;retry.addEventListener('click',()=>load(activeUrl));
    const body=document.createElement('div');body.className='json-viewer-body';
    const pre=document.createElement('pre');pre.tabIndex=0;pre.setAttribute('aria-label','Formatted JSON');code=document.createElement('code');pre.append(code);body.append(status,retry,pre);
    dialog.append(header,body);document.body.append(dialog);
    dialog.addEventListener('close',()=>{++sequence;controller?.abort();document.documentElement.classList.remove('json-viewer-open');code.textContent='';returnFocus?.isConnected&&returnFocus.focus();});
    dialog.addEventListener('cancel',()=>{controller?.abort();});
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button:not([disabled]),pre[tabindex]')].filter(element=>element.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  }
  async function boundedText(response,signal){
    const length=Number(response.headers.get('content-length'));
    if(length>maximumBytes){await response.body?.cancel();throw Error('too-large');}
    if(!response.body){const text=await response.text();if(new TextEncoder().encode(text).length>maximumBytes)throw Error('too-large');return text;}
    const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
    try{for(;;){if(signal.aborted)throw new DOMException('Cancelled','AbortError');const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maximumBytes){await reader.cancel();throw Error('too-large');}text+=decoder.decode(next.value,{stream:true});}return text+decoder.decode();}
    finally{reader.releaseLock();}
  }
  async function load(url){
    const current=++sequence;controller?.abort();controller=new AbortController();const requestController=controller;let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;requestController.abort();},15000);
    code.textContent='';code.parentElement.hidden=true;retry.hidden=true;dialog.setAttribute('aria-busy','true');
    status.textContent=message('Loading JSON record…','JSON-Beleg wird geladen …');status.classList.remove('is-error');
    try{
      const response=await fetch(url.href,{signal:requestController.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('unavailable');
      const type=response.headers.get('content-type')||'';if(!/(?:application|text)\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(type))throw Error('invalid');
      const text=await boundedText(response,requestController.signal);
      let formatted;try{formatted=JSON.stringify(JSON.parse(text),null,2);}catch{throw Error('invalid');}
      if(current!==sequence||!dialog.open)return;
      // JSON values are text, including HTML-looking strings. Never render them as markup.
      code.textContent=formatted;code.parentElement.hidden=false;
      status.textContent=message('Read-only record · formatted JSON','Schreibgeschützter Beleg · formatiertes JSON');
    }catch(error){
      if(current!==sequence||error.name==='AbortError'&&!timedOut||!dialog.open)return;
      status.classList.add('is-error');status.textContent=error.message==='too-large'?message('This record is too large to display (limit: 2 MB).','Dieser Beleg ist zu groß für die Anzeige (maximal 2 MB).'):error.message==='invalid'?message('This file does not contain valid JSON.','Diese Datei enthält kein gültiges JSON.'):message('The JSON record could not be loaded. Please try again.','Der JSON-Beleg konnte nicht geladen werden. Bitte erneut versuchen.');
      retry.textContent=message('Try again','Erneut versuchen');retry.hidden=false;
    }finally{clearTimeout(timer);if(current===sequence)dialog.removeAttribute('aria-busy');}
  }
  for(const link of root.querySelectorAll('a[href]'))if(recordUrl(link)){link.dataset.jsonViewer='';link.setAttribute('aria-haspopup','dialog');}
  root.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[data-json-viewer]');if(!link)return;
    const url=recordUrl(link);if(!url)return;
    if(!('HTMLDialogElement' in window)||typeof HTMLDialogElement.prototype.showModal!=='function')return;
    event.preventDefault();if(!dialog)createDialog();returnFocus=link;activeUrl=url;
    heading.textContent=link.textContent.trim()||message('JSON record','JSON-Beleg');
    try{filename.textContent=decodeURIComponent(url.pathname.split('/').pop());}catch{filename.textContent=url.pathname.split('/').pop();}
    closeButton.textContent=message('Close','Schließen');closeButton.setAttribute('aria-label',message('Close JSON record','JSON-Beleg schließen'));
    code.parentElement.setAttribute('aria-label',message('Formatted JSON','Formatiertes JSON'));
    if(!dialog.open)dialog.showModal();document.documentElement.classList.add('json-viewer-open');closeButton.focus();void load(url);
  });
}
