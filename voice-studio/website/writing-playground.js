import {findWritingSignals,composeWritingReviewPrompt,getWritingRule} from './writing-rules/index.js';
for(const playground of document.querySelectorAll('[data-writing-playground]')){
  const locale=playground.closest('[data-language]').dataset.language,de=locale==='de';
  const scan=playground.querySelector('[data-signal-form]'),compose=playground.querySelector('[data-prompt-form]');scan.hidden=false;compose.hidden=false;
  scan.addEventListener('submit',event=>{
    event.preventDefault();const list=scan.querySelector('[data-signal-results]'),status=scan.querySelector('[data-signal-status]');list.replaceChildren();
    try{
      const result=findWritingSignals(scan.querySelector('[data-signal-text]').value,{language:locale,maxSignals:30});
      status.textContent=de?`${result.signals.length} Textstellen zum Prüfen. Lokale Muster für ${result.coverage.scannedRuleIds.length} Regeln; Aufbau, Fakten und Urheberschaft wurden nicht bewertet.`:`${result.signals.length} passages to inspect. Local patterns for ${result.coverage.scannedRuleIds.length} rules; structure, facts and authorship were not assessed.`;
      if(result.coverage.truncated)status.textContent+=de?' Die Anzeige ist auf 30 Treffer begrenzt.':' Results are limited to 30 matches.';
      for(const signal of result.signals){
        const li=document.createElement('li'),quote=document.createElement('q'),link=document.createElement('a'),span=document.createElement('span');
        quote.textContent=signal.quote;link.href=`#${locale}-${signal.ruleId}`;link.textContent=getWritingRule(signal.ruleId).title[locale];span.textContent=de?`Position ${signal.start}–${signal.end} · UTF-16 · Entscheidung offen`:`Position ${signal.start}–${signal.end} · UTF-16 · review required`;li.append(quote,link,span);list.append(li);
      }
    }catch{status.textContent=de?'Der Text konnte nicht geprüft werden. Maximal 10.000 Zeichen eingeben.':'The text could not be checked. Enter at most 10,000 characters.';}
  });
  compose.addEventListener('submit',event=>{
    event.preventDefault();const status=compose.querySelector('[data-prompt-status]'),output=compose.querySelector('[data-prompt-result]');
    try{
      const result=composeWritingReviewPrompt({language:locale,profile:compose.querySelector('[data-prompt-profile]').value,audience:compose.querySelector('[data-prompt-audience]').value,goal:compose.querySelector('[data-prompt-goal]').value});
      output.querySelector('code').textContent=result.prompt;output.hidden=false;status.textContent=de?`${result.ruleIds.length} Regeln ausgewählt. Übergib die Quelle separat an deine Modellanbindung.`:`${result.ruleIds.length} rules selected. Supply the source separately through your model integration.`;
    }catch{output.hidden=true;status.textContent=de?'Bitte Zielgruppe und Ziel angeben (jeweils maximal 4.000 Zeichen).':'Enter an audience and goal (at most 4,000 characters each).';}
  });
}
