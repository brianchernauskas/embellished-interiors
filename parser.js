/* Embellished Interiors — turns a spoken/typed sentence into a draft entry.
   "add fifteen minutes to Park Villas for call from Cristina regarding movie room"
   → { type:'time', minutes:15, siteId:'park', note:'Call from Cristina regarding movie room' } */
(function (root) {
  const SITES = [
    { id: 'park', name: 'Park Villas', aliases: ['park villas', 'park villa', 'park'] },
    { id: 'houghton', name: 'Houghton', aliases: ['houghton', 'hawton', 'horton', 'holton'] },
    { id: 'goodyear', name: 'Goodyear', aliases: ['goodyear', 'good year'] },
    { id: 'lacanada', name: 'La Cañada', aliases: ['la canada', 'la canyada', 'la cannada', 'lacanada', 'la canida', 'canada'] },
    { id: 'chandler1', name: 'Chandler Phase 1', aliases: ['chandler phase one', 'chandler phase 1', 'chandler one', 'chandler 1', 'chandler phase i'] },
    { id: 'chandler2', name: 'Chandler Phase 2', aliases: ['chandler phase two', 'chandler phase 2', 'chandler phase too', 'chandler two', 'chandler 2'] },
  ];

  const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const NUMW = '(?:\\d+(?:\\.\\d+)?|(?:twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)';
  const H = '(?:hours?|hrs?)';
  const M = '(?:minutes?|mins?)';

  function toNum(s) {
    s = s.toLowerCase().trim();
    if (/^\d/.test(s)) return parseFloat(s);
    let n = 0;
    for (const p of s.split(/[\s-]+/)) n += TENS[p] || UNITS[p] || 0;
    return n;
  }

  const DURATIONS = [
    [new RegExp(`\\b(${NUMW})\\s+and\\s+a\\s+half\\s+${H}\\b`), m => toNum(m[1]) * 60 + 30],
    [/\ban?\s+hour\s+and\s+a\s+half\b/, () => 90],
    [/\ban?\s+hour\s+and\s+a\s+quarter\b/, () => 75],
    [/\bthree\s+quarters?\s+(?:of\s+)?an?\s+hour\b/, () => 45],
    [/\b(?:a\s+)?half\s+(?:an?\s+)?hour\b/, () => 30],
    [/\b(?:a\s+)?quarter\s+(?:of\s+)?(?:an?\s+)?hour\b/, () => 15],
    [new RegExp(`\\b(?:(${NUMW})|an?)\\s*${H}\\b(?:\\s*(?:and\\s*)?(${NUMW})\\s*${M}\\b)?`), m => (m[1] ? toNum(m[1]) : 1) * 60 + (m[2] ? toNum(m[2]) : 0)],
    [new RegExp(`\\b(${NUMW})\\s*${M}\\b`), m => toNum(m[1])],
  ];

  const FILLER = new Set(['add', 'log', 'put', 'enter', 'track', 'record', 'mileage', 'drove', 'drive', 'driven', 'driving', 'to', 'for', 'on', 'at', 'in', 'the', 'of', 'and', 'regarding', 're', 'about', 'with', 'please', 'time', 'a', 'an']);

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aliasList = SITES.flatMap(s => s.aliases.map(a => [a, s.id])).sort((a, b) => b[0].length - a[0].length);

  function parse(input) {
    const text = String(input || '');
    let work = text.toLowerCase().replace(/ñ/g, 'n'); // same length as text
    const spans = [];
    const take = m => {
      spans.push([m.index, m.index + m[0].length]);
      work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
    };
    const out = { type: 'time', minutes: 0, miles: 0, siteId: null, siteAmbiguous: false, note: '', dateOffset: 0 };

    // site
    for (const [alias, id] of aliasList) {
      const m = new RegExp(`\\b${esc(alias).replace(/ /g, '\\s+')}\\b`).exec(work);
      if (m) { out.siteId = id; take(m); break; }
    }
    if (!out.siteId) {
      const m = /\bchandler\b/.exec(work);
      if (m) { out.siteAmbiguous = true; take(m); }
    }

    // day
    let m = /\byesterday\b/.exec(work);
    if (m) { out.dateOffset = -1; take(m); }
    m = /\btoday\b/.exec(work);
    if (m) take(m);

    // mileage
    m = new RegExp(`\\b(${NUMW})\\s*(?:miles?|mi)\\b`).exec(work);
    if (m) { out.type = 'mileage'; out.miles = toNum(m[1]); take(m); }
    else {
      m = /\b(?:mileage|drove|driven)\b[^\d]{0,25}?(\d+(?:\.\d+)?)/.exec(work);
      if (m) { out.type = 'mileage'; out.miles = parseFloat(m[1]); take(m); }
      else if (/\bmileage\b/.test(work)) out.type = 'mileage';
    }

    // time
    if (out.type === 'time') {
      for (const [re, fn] of DURATIONS) {
        m = re.exec(work);
        if (m) { out.minutes = fn(m); take(m); break; }
      }
      if (!out.minutes) {
        m = /\b(\d+)\b/.exec(work);
        if (m && +m[1] >= 5 && +m[1] <= 480) { out.minutes = +m[1]; take(m); }
      }
    }

    // note = what's left
    spans.sort((a, b) => a[0] - b[0]);
    let note = '', pos = 0;
    for (const [s, e] of spans) { note += text.slice(pos, s) + ' '; pos = e; }
    note += text.slice(pos);
    let words = note.replace(/[,;]+/g, ' ').split(/\s+/).filter(Boolean);
    while (words.length && FILLER.has(words[0].toLowerCase())) words.shift();
    while (words.length && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
    note = words.join(' ').replace(/^[\s.\-–:]+|[\s.\-–:]+$/g, '');
    out.note = note ? note[0].toUpperCase() + note.slice(1) : '';
    return out;
  }

  const api = { parse, SITES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EIParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
