import ts from 'typescript';
import {readFileSync} from 'node:fs';
function extract(source) {
if (typeof source !== 'string' || source.length > 2_100_000) throw new Error('Invalid TypeScript source size');
const file = ts.createSourceFile('voice-content.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (file.parseDiagnostics.length) throw new Error('TypeScript syntax error: ' + ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, ' '));
const prose = new Set('title titles headline headlines headlineLines heroKicker kicker eyebrow heading headings subheading subtitle seoTitle metaDescription description descriptions lead summary heroOperational label labels navLabel body paragraphs paragraph quote quotes text texts caption captions alt annotations statusChips bullets bullet items intro introduction note notes detail details message helperText placeholder cta value benefit benefits question answer count'.toLowerCase().split(' '));
const units = [];
let excluded = 0, visibleLength = 0;
function decode(node) {
  const start = node.getStart(file) + 1, end = node.getEnd() - 1;
  const raw = source.slice(start, end), template = source.charCodeAt(start - 1) === 96;
  let text = ''; const starts = [], ends = [];
  function append(value, from, to, direct = false) {
    for (let i = 0; i < value.length; i++) {
      text += value[i];
      starts.push(direct ? start + from + i : i === 0 ? start + from : -1);
      ends.push(direct ? start + from + i + 1 : i === value.length - 1 ? start + to : -1);
    }
  }
  for (let i = 0; i < raw.length;) {
    if (raw[i] !== '\\') {
      if (template && raw[i] === '\r') { const n = raw[i + 1] === '\n' ? 2 : 1; append('\n', i, i + n); i += n; }
      else { append(raw[i], i, i + 1, true); i++; }
      continue;
    }
    const from = i, ch = raw[i + 1];
    if (ch === undefined) return null;
    if (ch === '\n' || ch === '\r') { i += ch === '\r' && raw[i + 2] === '\n' ? 3 : 2; continue; }
    const simple = {'b':'\b','f':'\f','n':'\n','r':'\r','t':'\t','v':'\v','0':'\0'};
    if (ch in simple) { append(simple[ch], from, i + 2); i += 2; continue; }
    if (ch === 'x') {
      const hex = raw.slice(i + 2, i + 4); if (!/^[\da-f]{2}$/i.test(hex)) return null;
      append(String.fromCharCode(parseInt(hex, 16)), from, i + 4); i += 4; continue;
    }
    if (ch === 'u') {
      if (raw[i + 2] === '{') {
        const close = raw.indexOf('}', i + 3); if (close < 0) return null;
        const hex = raw.slice(i + 3, close); if (!/^[\da-f]{1,6}$/i.test(hex) || parseInt(hex, 16) > 0x10ffff) return null;
        append(String.fromCodePoint(parseInt(hex, 16)), from, close + 1); i = close + 1; continue;
      }
      const hex = raw.slice(i + 2, i + 6); if (!/^[\da-f]{4}$/i.test(hex)) return null;
      append(String.fromCharCode(parseInt(hex, 16)), from, i + 6); i += 6; continue;
    }
    append(ch, from, i + 2); i += 2;
  }
  return text === node.text ? {text, start, end, starts, ends} : null;
}
function unwrap(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node)) node = node.expression;
  return node;
}
function visit(value, path) {
  const node = unwrap(value);
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop) || ts.isComputedPropertyName(prop.name)) { excluded++; continue; }
      if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) { excluded++; continue; }
      visit(prop.initializer, [...path, prop.name.text]);
    }
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach((element, index) => visit(element, [...path, '[' + index + ']']));
  } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const key = path.findLast(x => !x.startsWith('['))?.toLowerCase();
    if (!prose.has(key)) { excluded++; return; }
    const mapped = decode(node);
    if (!mapped || !mapped.text.isWellFormed() || !/\p{L}/u.test(mapped.text) || /^(?:https?:\/\/|\/|#[\w-]+$)/i.test(mapped.text) || /<\/?[a-z][^>]*>/i.test(mapped.text)) { excluded++; return; }
    // A rendered count may contain a public claim, while numeric counters and
    // single technical tokens remain outside prose analysis.
    if (key === 'count' && !/\s/u.test(mapped.text.trim())) { excluded++; return; }
    visibleLength += mapped.text.length;
    if (units.length >= 5000 || visibleLength > 500000) throw new Error('Configured TypeScript content exceeds adapter limits');
    const kind = /^(title|headline|headlinelines|heading)$/.test(key) ? (path.filter(p => !p.startsWith('[')).length <= 2 ? 'h1' : 'h2') : 'p';
    units.push({...mapped, kind, property: path.join('.')});
  } else if (!ts.isNumericLiteral(node) && node.kind !== ts.SyntaxKind.TrueKeyword && node.kind !== ts.SyntaxKind.FalseKeyword && node.kind !== ts.SyntaxKind.NullKeyword) excluded++;
}
for (const statement of file.statements) {
  if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) { excluded++; continue; }
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.initializer && ts.isIdentifier(declaration.name)) visit(declaration.initializer, [declaration.name.text]);
    else excluded++;
  }
}
const allText = units.map(x => x.text).join(' ');
const german = (allText.match(/\b(der|die|das|und|ein|eine|für|mit|wird|ist)\b/gi) || []).length;
const english = (allText.match(/\b(the|and|this|with|for|is|are|your|you)\b/gi) || []).length;
return {units, excludedRegions: excluded, language: german > english ? 'de' : 'en'};
}
const input = JSON.parse(readFileSync(0, 'utf8'));
if (Array.isArray(input.sources)) {
  if (input.sources.length > 64) throw new Error('Too many TypeScript files in one batch');
  process.stdout.write(JSON.stringify(input.sources.map(extract)));
} else process.stdout.write(JSON.stringify(extract(input.source)));
