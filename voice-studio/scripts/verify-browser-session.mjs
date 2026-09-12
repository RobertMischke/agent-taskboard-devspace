// Uses an isolated persistent Chrome profile; credentials never appear in output or artifacts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readSession } from './session.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.VOICE_STUDIO_URL ?? 'http://127.0.0.1:5188';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-browser-login-'));
const session = await readSession(root);
let context;
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const options = { channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 }, timeout: 15000 };
const connected = page => page.locator('.studio-header .session-logout').waitFor({ state: 'visible', timeout: 20000 });
try {
  context = await chromium.launchPersistentContext(profile, options);
  let page = context.pages()[0];
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#pairing-code').waitFor();
  check(await page.locator('#remember-browser').isChecked(), 'Remember browser is clearly offered and checked by default.');
  await page.locator('#pairing-code').fill(session.pairingCode);
  const pairResponse = page.waitForResponse(response => response.url().endsWith('/api/session/pair'));
  await page.getByRole('button', { name: 'Open local Studio', exact: false }).click();
  let result = await (await pairResponse).json();
  await connected(page);
  const cookie = (await context.cookies(base + '/api/session/resume')).find(item => item.name.startsWith('voice-studio-browser-'));
  check(cookie?.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/api/session' && cookie.expires > Date.now()/1000 + 6*86400, 'Actual Chrome stores a seven-day HttpOnly, Strict, path-scoped cookie.');
  check(cookie.value !== result.token, 'Cookie is distinct from the API token.');
  const exposed = await page.evaluate(() => ({ cookie: document.cookie, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), url: location.href }));
  check(!Object.values(exposed).some(value => value.includes(result.token) || value.includes(cookie.value)), 'Neither secret appears in JavaScript-readable storage, cookies or URLs.');
  const unauthorized = await page.evaluate(async () => (await fetch('/api/projects')).status);
  check(unauthorized === 401, 'Remembered cookie never directly grants project API access.');
  await page.reload({ waitUntil: 'domcontentloaded' }); await connected(page);
  check(await page.locator('#pairing-code').count() === 0, 'Reload restores the remembered browser without entering a code.');
  const newTab = await context.newPage(); await newTab.goto(base, { waitUntil: 'domcontentloaded' }); await connected(newTab);
  check(await newTab.locator('#pairing-code').count() === 0, 'A new tab resumes without a code.');
  await newTab.close();
  await context.close(); context = null;
  context = await chromium.launchPersistentContext(profile, options);
  page = context.pages()[0]; await page.goto(base, { waitUntil: 'domcontentloaded' }); await connected(page);
  check(await page.locator('#pairing-code').count() === 0, 'Closing and reopening Chrome preserves the trusted-browser session.');
  for (const origin of ['https://untrusted.example', 'http://127.0.0.1:5189', 'http://localhost:5188']) {
    const response = await context.request.post(base + '/api/session/resume', { headers: { Origin: origin, 'X-Voice-Studio-Session':'1' }, data: {} });
    check(response.status() === 403, 'Foreign origin and sibling local page cannot resume a cookie session.');
  }
  const noIntent = await context.request.post(base + '/api/session/resume', { headers: { Origin: base }, data:{} });
  check(noIntent.status() === 403, 'Resume rejects a request without the browser-intent header.');
  await page.locator('.studio-header .session-logout').click();
  await page.locator('#pairing-code').waitFor();
  check(!(await context.cookies(base + '/api/session/resume')).some(item=>item.name===cookie.name), 'Sign out removes the actual browser credential.');
  const revoked = await context.request.get(base+'/api/projects', { headers: { Authorization: 'Bearer ' + result.token } });
  check(revoked.status()===401, 'Sign out revokes the browser API bearer on the server.');
  await page.reload({waitUntil:'domcontentloaded'}); await page.locator('#pairing-code').waitFor();
  check(await page.locator('#pairing-code').isVisible(), 'Reload after sign out requires an explicit code.');
  await page.locator('#remember-browser').uncheck(); await page.locator('#pairing-code').fill(session.pairingCode);
  await page.getByRole('button', {name:'Open local Studio',exact:false}).click(); await connected(page);
  check(!(await context.cookies(base+'/api/session/resume')).some(item=>item.name.startsWith('voice-studio-browser-')), 'Unchecked remember option keeps ordinary temporary pairing.');
  await page.reload({waitUntil:'domcontentloaded'}); await page.locator('#pairing-code').waitFor();
  check(await page.locator('#pairing-code').isVisible(), 'Unremembered session does not silently persist on reload.');
  await page.getByRole('combobox',{name:'Language / Sprache',exact:true}).selectOption('de');
  check(await page.getByText('Diesen Browser 7 Tage merken',{exact:true}).isVisible(), 'Remembered-browser controls have a German translation.');
  console.log(`Browser session UI: ${checks} checks passed, including actual Chrome close/reopen, reload, new tab, logout, origin rejection and temporary mode; isolated browser profile, no source or proposal writes.`);
} finally {
  if (context) {
    // Best-effort revoke only this isolated profile if a prior assertion interrupted the workflow.
    await context.request.post(base+'/api/session/logout',{headers:{Origin:base,'X-Voice-Studio-Session':'1'},data:{}}).catch(()=>{});
    await context.close();
  }
  const resolved=path.resolve(profile), temporary=path.resolve(os.tmpdir())+path.sep;
  if(!resolved.startsWith(temporary)||!path.basename(resolved).startsWith('voice-browser-login-'))throw Error('Unexpected profile cleanup path');
  await fs.rm(resolved,{recursive:true,force:true,maxRetries:3});
}
