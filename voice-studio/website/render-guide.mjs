import path from 'node:path';
import {Marked, Renderer} from 'marked';
import ts from 'typescript';
import {escape, documentPage} from './template.mjs';
import {guides} from './guides.mjs';

export function highlightCode(text, language) {
  if (!['ts','typescript','js','javascript','json'].includes(language)) return escape(text);
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,text);
  let result='', kind;
  while((kind=scanner.scan())!==ts.SyntaxKind.EndOfFileToken){
    const value=escape(scanner.getTokenText());
    const type=kind>=ts.SyntaxKind.FirstKeyword&&kind<=ts.SyntaxKind.LastKeyword?'keyword':
      [ts.SyntaxKind.StringLiteral,ts.SyntaxKind.NoSubstitutionTemplateLiteral].includes(kind)?'string':
      [ts.SyntaxKind.SingleLineCommentTrivia,ts.SyntaxKind.MultiLineCommentTrivia].includes(kind)?'comment':
      kind===ts.SyntaxKind.NumericLiteral?'number':'';
    result+=type?`<span class="syntax-${type}">${value}</span>`:value;
  }
  return result;
}

export function renderGuide(guide, markdown, sourceTargets) {
  const toc=[], ids=new Map(), repositoryReferences=new Set();
  const relativeTarget=target=>(path.posix.relative(`guides/${guide.slug}`,target)||'.')+(target.endsWith('/')?'/':'');
  function hrefFor(href) {
    if(href.startsWith('#')) return href;
    if(/^https?:\/\//i.test(href)||/^mailto:/i.test(href)) return href;
    if(/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith('//')) return null;
    const [pathname,fragment]=href.split('#');
    const source=path.posix.normalize(path.posix.join(path.posix.dirname(guide.source),pathname));
    const target=sourceTargets.get(source);
    if(!target){repositoryReferences.add(source);return null}
    return relativeTarget(target)+(fragment?'#'+fragment:'');
  }
  const renderer={
    heading({tokens,depth,text}) {
      const base=text.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-')||'section';
      const occurrence=ids.get(base)||0;ids.set(base,occurrence+1);const id=base+(occurrence?'-'+occurrence:'');
      if(depth===2)toc.push({id,text:text.replace(/[`*_]/g,'')});
      return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}<a class="heading-anchor" href="#${escape(id)}" aria-label="Link to this section">#</a></h${depth}>`;
    },
    html({text}) {return escape(text)},
    link({href,title,tokens}) {
      const safe=hrefFor(href),text=this.parser.parseInline(tokens);
      return safe?`<a href="${escape(safe)}"${/\.json(?:[?#]|$)/i.test(safe)&&!/^([a-z][a-z0-9+.-]*:|#)/i.test(safe)?' data-json-viewer aria-haspopup="dialog"':''}${title?` title="${escape(title)}"`:''}>${text}</a>`:`<span class="repository-reference" title="Reference in the source repository">${text}</span>`;
    },
    image({href,text}) {
      const safe=hrefFor(href);
      return safe&&!/^https?:/i.test(safe)?`<img src="${escape(safe)}" alt="${escape(text)}" loading="lazy">`:escape(text);
    },
    code({text,lang}) {
      const language=(lang||'text').split(/\s/)[0].toLowerCase();
      return `<figure class="code-block"><figcaption><span>${escape(language)}</span><button type="button" class="copy-code" data-en="Copy" data-de="Kopieren" hidden>Copy</button></figcaption><pre tabindex="0" aria-label="${escape(language)} code"><code>${highlightCode(text,language)}</code></pre></figure>`;
    },
    table(token) {return `<div class="table-scroll" tabindex="0" role="region" aria-label="Documentation table">${Renderer.prototype.table.call(this,token)}</div>`},
  };
  const marked=new Marked({gfm:true,renderer});
  // The catalog supplies the page heading; remove just the Markdown document title.
  const body=marked.parse(markdown.replace(/^# [^\r\n]+\r?\n/,''));
  const menu=['Start here','Reference','Maintenance'].map(group=>{
    const items=guides.filter(g=>g.group===group);
    const links=items.map(g=>`<a href="../${g.slug}/"${g.slug===guide.slug?' aria-current="page"':''}>${escape(g.title)}</a>`).join('');
    return group==='Start here'?`<div class="guide-group"><p>Start here</p>${links}</div>`:`<details class="guide-group guide-group-details"${items.some(g=>g.slug===guide.slug)?' open':''}><summary>${group}</summary>${links}</details>`;
  }).join('');
  const outline=toc.map(item=>`<a href="#${escape(item.id)}">${escape(item.text)}</a>`).join('');
  const nextBySlug={'writing-rules':'agent-integration','ai-text-signals':'writing-rules',workflow:'library',library:'library-types','library-types':'live-bridge','live-bridge':'agent-integration','agent-integration':'runner-integration','runner-integration':'checks',usability:'workflow',session:'workflow','holistic-review':'agent-integration','model-strategy':'runner-integration','language-tooling':'holistic-review',maintaining:'commands',commands:'verification'};
  const next=guides.find(g=>g.slug===nextBySlug[guide.slug]);
  const sourceInfo=`<details class="source-details"><summary data-en="Git and source reference" data-de="Git- und Quellbezug">Git and source reference</summary><p lang="en">This HTML page is built from <code>${escape(guide.source)}</code> in the Voice Studio source tree. Its content hash and checkout revision are recorded in the <a href="../../build-info.json">build record</a>.</p>${guide.slug==='verification'?'':`<a href="../../sources/${guide.slug}.md" download data-en="Download the Markdown source" data-de="Markdown-Quelle herunterladen">Download the Markdown source</a>`}${repositoryReferences.size?`<p lang="en">Additional repository references (not published as website routes):</p><ul>${[...repositoryReferences].map(ref=>`<li><code>${escape(ref)}</code></li>`).join('')}</ul>`:''}</details>`;
  const content=`<div class="docs-breadcrumb"><a href="../../docs/" data-en="Docs" data-de="Doku">Docs</a><span aria-hidden="true">/</span><span>${escape(guide.group)}</span></div><div class="docs-layout"><aside class="guide-sidebar"><details class="guide-menu" open><summary data-en="All guides" data-de="Alle Guides">All guides</summary><nav aria-label="Documentation">${menu}</nav></details></aside><article class="guide-article" lang="en"><header class="guide-heading">${["Workflow + plan","Design · planned","Current + planned","Historical record"].includes(guide.status)?`<span class="guide-status">${escape(guide.status)}</span>`:""}<h1>${escape(guide.title)}</h1><p class="lead">${escape(guide.description)}</p><p class="guide-language" data-en="Guide in English." data-de="Guide auf Englisch.">Guide in English.</p></header><details class="mobile-outline"><summary data-en="On this page" data-de="Auf dieser Seite">On this page</summary><nav aria-label="Page sections">${outline}</nav></details><div class="guide-content">${body}</div>${sourceInfo}${next?`<a class="next-guide" href="../${next.slug}/"><span data-en="Next guide" data-de="Nächster Guide">Next guide</span><strong>${escape(next.title)} →</strong></a>`:''}</article><aside class="page-outline"><p data-en="On this page" data-de="Auf dieser Seite">On this page</p><nav aria-label="On this page">${outline}</nav></aside></div>`;
  return documentPage({title:`${guide.title} · Voice docs`,description:guide.description,slug:`guides/${guide.slug}`,content,guide:true});
}
