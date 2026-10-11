// Sync to a private GitHub repo through the contents API.
// The token lives only on this device, under its own key, and is never exported.
const CFG_KEY = 'focusisle.sync';
export const DATA_PATH = 'focus-isle.json';
export const DEFAULT_REPO = 'asimdave11/focus-isle-data';

export function getCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; }
}
export function setCfg(patch) {
  const next = { ...getCfg(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch {}
  return next;
}
export function disconnect() { try { localStorage.removeItem(CFG_KEY); } catch {} }
export const isOn = () => !!(getCfg().token && getCfg().repo);

const b64encode = (str) => {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

export class SyncError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Dev only: ?api=http://127.0.0.1:PORT points at a local mock, and only when the app itself runs on localhost.
const LOCAL = /^(127\.0\.0\.1|localhost)$/;
const devApi = new URLSearchParams(location.search).get('api');
const devHost = (() => { try { return new URL(devApi).hostname; } catch { return ''; } })();
const API_BASE = devApi && LOCAL.test(location.hostname) && LOCAL.test(devHost) ? devApi.replace(/\/$/, '') : 'https://api.github.com';

async function api(path, { method = 'GET', body } = {}) {
  const { token } = getCfg();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new SyncError(0, 'No connection. It will sync when you are back online.');
  }
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) {
    const msg = {
      401: 'GitHub rejected the token; it may have expired. Tap Disconnect, then connect again with a new token.',
      403: 'The token is not allowed to write to this repo. Give it Contents: read and write.',
      404: 'Repo not found, or the token cannot see it.',
    }[res.status] || `GitHub error ${res.status}.`;
    throw new SyncError(res.status, msg);
  }
  return res.status === 204 ? {} : res.json();
}

const contentsPath = (repo, path) => `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

export async function checkRepo() {
  const { repo } = getCfg();
  const r = await api(`/repos/${repo}`);
  if (!r) throw new SyncError(404, 'Repo not found, or the token cannot see it.');
  if (r.permissions && r.permissions.push === false) throw new SyncError(403, 'The token can read this repo but not write to it. Give it Contents: read and write.');
  return r;
}

export async function getFile(path) {
  const { repo } = getCfg();
  const j = await api(contentsPath(repo, path));
  if (!j) return null;
  if (j.content) return { sha: j.sha, text: b64decode(j.content) };
  // Files over 1 MB come back without inline content; fetch the blob instead.
  const blob = await api(`/repos/${repo}/git/blobs/${j.sha}`);
  return { sha: j.sha, text: b64decode(blob.content) };
}

export async function putFile(path, text, sha, message) {
  const { repo } = getCfg();
  const j = await api(contentsPath(repo, path), { method: 'PUT', body: { message, content: b64encode(text), ...(sha && { sha }) } });
  return j.content?.sha;
}
