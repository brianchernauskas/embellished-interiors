const { parse } = require('./parser.js');
const cases = [
  ['add fifteen minutes to Park Villas for call from Cristina regarding movie room', { type: 'time', minutes: 15, siteId: 'park', note: 'Call from Cristina regarding movie room' }],
  ['30 minutes Houghton ordering curtains', { minutes: 30, siteId: 'houghton', note: 'Ordering curtains' }],
  ['an hour and a half Goodyear shopping for decor', { minutes: 90, siteId: 'goodyear', note: 'Shopping for decor' }],
  ['half an hour La Cañada paint call', { minutes: 30, siteId: 'lacanada', note: 'Paint call' }],
  ['add forty five minutes to Chandler phase two regarding tile', { minutes: 45, siteId: 'chandler2', note: 'Tile' }],
  ['1.5 hours chandler one walk through', { minutes: 90, siteId: 'chandler1', note: 'Walk through' }],
  ['two hours Park Villas', { minutes: 120, siteId: 'park', note: '' }],
  ['add 15 to Goodyear', { minutes: 15, siteId: 'goodyear' }],
  ['15 minutes Chandler call with Dan', { minutes: 15, siteId: null, siteAmbiguous: true, note: 'Call with Dan' }],
  ['mileage 35 miles to Goodyear', { type: 'mileage', miles: 35, siteId: 'goodyear' }],
  ['drove 145 miles Houghton', { type: 'mileage', miles: 145, siteId: 'houghton' }],
  ['add fifteen minutes to Park Villas yesterday for email', { minutes: 15, siteId: 'park', dateOffset: -1, note: 'Email' }],
  ['one hour and 15 minutes Houghton', { minutes: 75, siteId: 'houghton' }],
];
let bad = 0;
for (const [input, want] of cases) {
  const got = parse(input);
  for (const k of Object.keys(want)) {
    if (got[k] !== want[k]) { bad++; console.log('FAIL', JSON.stringify(input), k, 'want', want[k], 'got', got[k]); }
  }
}
console.log(bad ? `${bad} failures` : `all ${cases.length} passed`);
