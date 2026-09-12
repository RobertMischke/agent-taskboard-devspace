for(const article of document.querySelectorAll('[data-language]')){
  const form=article.querySelector('[data-pattern-filters]');if(!form)continue;
  form.hidden=false;
  const search=form.querySelector('[data-pattern-search]'),category=form.querySelector('[data-pattern-category]'),status=article.querySelector('[data-pattern-status]');
  const rules=[...article.querySelectorAll('[data-pattern-rule]')];
  const filter=()=>{
    const query=search.value.trim().toLocaleLowerCase(article.dataset.language);
    for(const rule of rules)rule.hidden=!!((category.value&&category.value!==rule.dataset.category)||(query&&!rule.textContent.toLocaleLowerCase(article.dataset.language).includes(query)));
    for(const group of article.querySelectorAll('[data-pattern-group]'))group.hidden=![...group.querySelectorAll('[data-pattern-rule]')].some(rule=>!rule.hidden);
    const count=rules.filter(rule=>!rule.hidden).length;status.hidden=false;status.textContent=article.dataset.language==='de'?`${count} von ${rules.length} Regeln`:`${count} of ${rules.length} rules`;
  };
  form.addEventListener('submit',event=>event.preventDefault());search.addEventListener('input',filter);category.addEventListener('change',filter);
}
function openRuleHash(){
  let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
  const rule=document.getElementById(id);if(!rule?.matches('[data-pattern-rule]'))return;
  const article=rule.closest('[data-language]');
  if(article?.hidden)document.querySelector(`[data-locale="${article.dataset.language}"]`)?.click();
  const form=article.querySelector('[data-pattern-filters]');form.querySelector('input').value='';form.querySelector('select').value='';form.querySelector('input').dispatchEvent(new Event('input'));
  rule.open=true;requestAnimationFrame(()=>rule.scrollIntoView({block:'start'}));
}
window.addEventListener('hashchange',openRuleHash);openRuleHash();

document.addEventListener('click',event=>{const link=event.target.closest?.('a[href^="#"]');if(link&&link.hash===location.hash)openRuleHash();});
