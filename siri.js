/* Siri inbox. A Shortcut POSTs the dictated sentence to a Firestore "inbox" keyed by a random
   128-bit secret; the app lists the inbox when opened, shows a confirm card, then deletes the item.
   Raw REST, no SDK. The secret key lives only on the phone (and in the Shortcut) — never in the repo. */
(function (root) {
  const PROJECT = 'bourbonffldraft';
  const API_KEY = 'AIzaSyAp1tnKQKXJuE-XZrETMGX6yCM5XxYzOWg'; // public web key, same as the other sites
  const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const LS = 'ei.siriKey';
  const VALID = /^[a-f0-9]{32}$/;

  function getKey() {
    try {
      let k = localStorage.getItem(LS);
      if (!VALID.test(k || '')) {
        const a = new Uint8Array(16); crypto.getRandomValues(a);
        k = [...a].map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(LS, k);
      }
      return k;
    } catch (e) { return null; }
  }
  function setKey(k) {
    k = String(k || '').trim().toLowerCase();
    if (!VALID.test(k)) return false;
    try { localStorage.setItem(LS, k); return true; } catch (e) { return false; }
  }
  const base = (k = getKey()) => `${ROOT}/embellished/${k}/inbox`;
  const endpoint = () => `${base()}?key=${API_KEY}`;
  const sendLink = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}send.html?k=${getKey()}&say=`;

  // -> { items: [{id, text, at}] } | { error }
  async function list() {
    if (!getKey()) return { error: 'nokey' };
    let res;
    try { res = await fetch(`${base()}?key=${API_KEY}&pageSize=50`, { cache: 'no-store' }); }
    catch (e) { return { error: 'offline' }; }
    if (res.status === 403) return { error: 'denied' };
    if (!res.ok) return { error: `http ${res.status}` };
    const d = await res.json();
    const items = (d.documents || []).map(doc => ({
      id: doc.name.split('/').pop(),
      text: (doc.fields && doc.fields.text && doc.fields.text.stringValue) || '',
      at: doc.createTime || '',
    })).sort((a, b) => a.at.localeCompare(b.at));
    return { items };
  }
  async function remove(id) {
    try { const r = await fetch(`${base()}/${encodeURIComponent(id)}?key=${API_KEY}`, { method: 'DELETE' }); return r.ok; }
    catch (e) { return false; }
  }
  async function send(text, key) {
    if (key && !VALID.test(key)) return { error: 'badkey' };
    try {
      const r = await fetch(`${base(key || getKey())}?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { text: { stringValue: String(text).slice(0, 500) } } }),
      });
      return r.ok ? { ok: true } : { error: r.status === 403 ? 'denied' : `http ${r.status}` };
    } catch (e) { return { error: 'offline' }; }
  }

  root.EISiri = { getKey, setKey, endpoint, sendLink, list, remove, send };
})(window);
