/* Home Bar – läuft komplett im Browser.
   Rezepte: TheCocktailDB (kostenlose API) · Barcodes: Open Food Facts · Eigene Daten: localStorage */
(() => {
  'use strict';

  const API = 'https://www.thecocktaildb.com/api/json/v1/1/';
  const OFF = 'https://world.openfoodfacts.org/api/v2/product/';
  const ING_IMG = n => `https://www.thecocktaildb.com/images/ingredients/${encodeURIComponent(n)}-Small.png`;
  const K = {
    db: 'hb.db.v1', bar: 'hb.bar.v1', own: 'hb.own.v1', fav: 'hb.fav.v1', theme: 'hb.theme', shop: 'hb.shop.v1',
    notes: 'hb.notes.v1', hist: 'hb.hist.v1', low: 'hb.low.v1', af: 'hb.af', lang: 'hb.lang'
  };
  const DB_TTL = 7 * 24 * 3600 * 1000;
  const PAGE = 48;
  const DE = window.DE_INGREDIENTS || {}, DE_CAT = window.DE_CATEGORIES || {}, DE_GLASS = window.DE_GLASSES || {};
  const STR = window.HB_STRINGS;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Hilfsfunktionen ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const icon = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20Z"/></svg>'
  };

  // ---------- Sprache ----------
  let lang = load(K.lang, null) || 'de';
  if (!STR[lang]) lang = 'de';
  function t(k, v) {
    let s = STR[lang][k] ?? STR.de[k] ?? k;
    if (typeof s === 'function') s = s(v || {});
    return v ? String(s).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '') : s;
  }
  const ingName = n => lang === 'de' ? (DE[key(n)] || n) : n;
  const catName = c => lang === 'de' ? (DE_CAT[c] || c) : (c === 'Eigenes' ? 'Own recipe' : c);
  const glassName = g => lang === 'de' ? (DE_GLASS[g] || g) : g;
  const fmtDate = ts => new Date(ts).toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  function applyStatic() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    $$('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
    $('#lang-btn').textContent = lang === 'de' ? 'EN' : 'DE';
    $('#af-btn').title = t('afTitle');
    document.title = t('docTitle');
    renderTagBars();
  }

  // ---------- Gleichwertige Zutaten ----------
  const EQUIV = [
    ['lemon', 'lemon juice'], ['lime', 'lime juice'], ['sugar syrup', 'simple syrup'],
    ['light rum', 'white rum'], ['whiskey', 'whisky'], ['carbonated water', 'soda water', 'club soda'],
    ['coca-cola', 'cola'], ['sprite', '7-up', 'lemon-lime soda'], ['heavy cream', 'whipping cream'],
    ['light cream', 'half-and-half'], ['jagermeister', 'jägermeister'], ['kahlua', 'coffee liqueur'],
    ['sweet vermouth', 'red vermouth', 'rosso vermouth'], ['malibu rum', 'coconut rum'], ['baileys irish cream', 'irish cream']
  ];
  const equivOf = new Map();
  EQUIV.forEach(g => g.forEach(k => equivOf.set(k, g)));

  // ---------- Alkoholfreie Alternativen ----------
  // [Muster, Ersatz-Zutat]; null = Zutat bleibt (z. B. Bitters, nur ein Spritzer)
  const AF_SUBS = [
    [/blue curacao/, 'Blue Curaçao syrup'], [/triple sec|cointreau|grand marnier|curacao/, 'Orange syrup'],
    [/amaretto/, 'Orgeat syrup'], [/kahlua|coffee liqueur|tia maria/, 'Espresso'], [/baileys|irish cream/, 'Cream'],
    [/peach schnapps/, 'Peach nectar'], [/creme de cassis/, 'Blackcurrant syrup'], [/chambord|raspberry liqueur/, 'Raspberry syrup'],
    [/creme de menthe|peppermint schnapps/, 'Mint syrup'], [/creme de cacao/, 'Chocolate syrup'], [/creme de banane|banana liqueur/, 'Banana syrup'],
    [/malibu|coconut rum|coconut liqueur/, 'Coconut syrup'], [/midori|melon liqueur/, 'Melon syrup'], [/elderflower liqueur|st\. germain/, 'Elderflower cordial'],
    [/cherry brandy|maraschino liqueur|kirschwasser/, 'Cherry syrup'], [/galliano/, 'Vanilla syrup'], [/sloe gin/, 'Sloe syrup'],
    [/limoncello/, 'Lemon syrup'], [/apricot brandy/, 'Apricot nectar'], [/frangelico/, 'Hazelnut syrup'], [/strawberry schnapps/, 'Strawberry syrup'],
    [/absinthe?|pernod|sambuca|ouzo|anis/, 'Anise syrup'], [/campari|aperol|cynar/, 'Non-alcoholic bitter aperitif'],
    [/vermouth|lillet|dubonnet/, 'Non-alcoholic aperitif'],
    [/champagne|prosecco|sparkling wine/, 'Non-alcoholic sparkling wine'], [/red wine/, 'Non-alcoholic red wine'], [/white wine|^wine$/, 'Non-alcoholic white wine'],
    [/cider/, 'Non-alcoholic cider'], [/\bbeer\b|lager|\bale\b|stout|guinness|corona/, 'Non-alcoholic beer'],
    [/\bgin\b/, 'Non-alcoholic gin'], [/vodka|absolut/, 'Non-alcoholic vodka'], [/tequila|mezcal/, 'Non-alcoholic tequila'],
    [/\brum\b|bacardi|cachaca/, 'Non-alcoholic rum'], [/whiske?y|bourbon|scotch|jack daniels|crown royal|johnnie walker/, 'Non-alcoholic whisky'],
    [/brandy|cognac|calvados|applejack|pisco/, 'Non-alcoholic whisky']
  ];
  const AF_DE = {
    'blue curaçao syrup': 'Blue-Curaçao-Sirup', 'orange syrup': 'Orangensirup', 'blackcurrant syrup': 'Johannisbeersirup', 'mint syrup': 'Minzsirup',
    'banana syrup': 'Bananensirup', 'melon syrup': 'Melonensirup', 'cherry syrup': 'Kirschsirup', 'sloe syrup': 'Schlehensirup', 'lemon syrup': 'Zitronensirup',
    'apricot nectar': 'Aprikosennektar', 'hazelnut syrup': 'Haselnusssirup', 'strawberry syrup': 'Erdbeersirup', 'anise syrup': 'Anissirup',
    'non-alcoholic bitter aperitif': 'Alkoholfreier Bitter-Aperitif', 'non-alcoholic aperitif': 'Alkoholfreier Aperitif',
    'non-alcoholic sparkling wine': 'Alkoholfreier Sekt', 'non-alcoholic red wine': 'Alkoholfreier Rotwein', 'non-alcoholic white wine': 'Alkoholfreier Weißwein',
    'non-alcoholic cider': 'Alkoholfreier Cidre', 'non-alcoholic beer': 'Alkoholfreies Bier', 'non-alcoholic gin': 'Alkoholfreier Gin',
    'non-alcoholic vodka': 'Alkoholfreier Wodka', 'non-alcoholic tequila': 'Alkoholfreier Tequila', 'non-alcoholic rum': 'Alkoholfreier Rum',
    'non-alcoholic whisky': 'Alkoholfreier Whisky'
  };
  Object.assign(DE, AF_DE);

  // ---------- Zustand ----------
  const state = {
    drinks: [], ingIndex: new Map(),
    bar: new Set(load(K.bar, [])), own: load(K.own, []), favs: new Set(load(K.fav, [])),
    shop: load(K.shop, []), notes: load(K.notes, {}), hist: load(K.hist, []), low: new Set(load(K.low, [])),
    af: load(K.af, false), guest: null, persons: 1,
    filter: 'all', tags: new Set(), query: '', shown: PAGE,
    loading: true, loadErr: null, progress: 0, editId: null
  };
  const saveBar = () => { if (!state.guest) save(K.bar, [...state.bar]); };
  const saveFavs = () => { if (!state.guest) save(K.fav, [...state.favs]); };
  const saveShop = () => save(K.shop, state.shop);
  const saveNotes = () => save(K.notes, state.notes);
  const saveHist = () => save(K.hist, state.hist);
  const saveLow = () => save(K.low, [...state.low]);
  const saveOwn = () => { if (!state.guest && !save(K.own, state.own)) toast(t('storageFull')); };

  // ---------- Geschmack, Stimmung, Werkzeug ----------
  const reSpirit = /\b(vodka|gin|rum|tequila|mezcal|whiske?y|scotch|bourbon|brandy|cognac|absinthe?|pisco|cachaca|everclear|grain alcohol|aquavit|kirschwasser|calvados|applejack|151|ouzo|pernod)\b/;
  const reLiqueur = /(liqueur|schnapps|creme de|crème de|triple sec|cointreau|grand marnier|curacao|amaretto|kahlua|baileys|irish cream|frangelico|drambuie|benedictine|chartreuse|galliano|southern comfort|midori|chambord|sambuca|anis|j[aä]germeister|campari|aperol|cynar|fernet|tia maria|malibu|goldschlager|limoncello|advocaat|st\. germain|passoa|licor|sloe gin|cherry brandy|apricot brandy|apple brandy|coconut rum|spiced rum)/;
  const reWine = /(vermouth|wine|champagne|prosecco|\bport\b|sherry|lillet|dubonnet|madeira|sake)/;
  const reBeer = /(\bbeer\b|lager|\bale\b|stout|guinness|cider|corona)/;
  const reNoAlc = /(ginger ale|ginger beer|root beer|non-alcoholic|bitters|syrup|nectar|cordial)/;
  const reMixer = /(juice|soda|tonic|cola|coke|sprite|7-up|lemonade|limeade|ginger ale|ginger beer|water|milk|cream|coffee|tea|espresso|nectar|pepsi|red bull|chocolate|sour mix|sweet and sour|yoghurt|ice-cream|coconut milk)/;
  const reSweet = /(syrup|grenadine|sugar|honey|liqueur|schnapps|creme de|crème de|amaretto|kahlua|baileys|irish cream|cream|chocolate|ice-cream|coconut|malibu|galliano|frangelico|midori|chambord|curacao|triple sec|cointreau|grand marnier|cola|coke|sprite|7-up|lemonade|ginger ale|pineapple juice|orange juice|cranberry juice|mango|peach|passion|nectar|banana|strawberr|raspberr|cherry|advocaat|marshmallow|caramel|vanilla|condensed milk|tia maria|southern comfort|falernum|orgeat|maple|agave|pepsi|dr\. pepper|red bull)/;
  const reStrongSweet = /(syrup|grenadine|sugar|honey|liqueur|schnapps|creme de|crème de|amaretto|kahlua|baileys|irish cream|chocolate|ice-cream|caramel|condensed milk|advocaat|orgeat|cream of coconut)/;
  const reSour = /(lemon|lime|sour mix|sweet and sour|grapefruit|cranberr|passion fruit|tamarind|yuzu|calamansi|citric)/;
  const reGarnish = /(peel|twist|zest|garnish|wheel|spiral|rim)/i;
  const reFruit = /(orange juice|pineapple|cranberr|mango|peach|passion|strawberr|raspberr|blueberr|blackberr|banana|apple juice|cherry|grenadine|melon|watermelon|kiwi|apricot|pomegranate|grape juice|grapefruit|fruit|berries|chambord|midori|creme de cassis|lychee)/;
  const reFresh = /(soda|tonic|ginger beer|ginger ale|sprite|7-up|lemonade|limeade|mint|cucumber|carbonated|club soda|crushed ice|lemon-lime|basil|prosecco|champagne)/;
  const reWinter = /(coffee|espresso|\btea\b|hot chocolate|cocoa|cinnamon|nutmeg|cloves|allspice|eggnog|advocaat|egg yolk|baileys|irish cream|butterscotch|caramel|apple cider|hot water|whipped cream|marshmallow|drambuie|\bport\b)/;

  function parseMl(measure) {
    const m = String(measure || '').toLowerCase().replace(',', '.');
    const num = m.match(/(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/);
    if (!num) return null;
    const n = num[1] ? +num[1] + num[2] / num[3] : num[4] ? num[4] / num[5] : +num[6];
    if (/\boz\b|ounce/.test(m)) return n * 30;
    if (/\bcl\b/.test(m)) return n * 10;
    if (/\bml\b/.test(m)) return n;
    if (/\bdl\b/.test(m)) return n * 100;
    if (/\bcup/.test(m)) return n * 240;
    if (/\bpint/.test(m)) return n * 470;
    if (/tbl|tablespoon|\btbsp/.test(m)) return n * 15;
    if (/tsp|teaspoon/.test(m)) return n * 5;
    if (/shot|jigger/.test(m)) return n * 45;
    if (/part/.test(m)) return n * 30;
    if (/dash|drop|splash/.test(m)) return n * 2;
    if (/\bl\b|liter|litre/.test(m)) return n * 1000;
    return null;
  }
  function abvOf(k) {
    if (reNoAlc.test(k)) return 0;
    if (/everclear|grain alcohol|151/.test(k)) return .7;
    if (reLiqueur.test(k)) return .25;
    if (reSpirit.test(k)) return .4;
    if (reWine.test(k)) return .15;
    if (reBeer.test(k)) return .05;
    return 0;
  }
  function computeTaste(d) {
    let sweet = 0, sour = 0, fruit = 0, fresh = 0, winter = 0, vol = 0, alc = 0;
    const txt = ((d.instr || '') + ' ' + (d.instrDE || '')).toLowerCase();
    for (const i of d.ings) {
      const k = key(i.name), garnish = reGarnish.test(i.measure || '') || /peel|zest|spiral/.test(k);
      if (!garnish) {
        if (reSweet.test(k)) sweet += reStrongSweet.test(k) ? 2 : 1;
        if (reSour.test(k) && !/lemonade|limeade|lemon-lime|lemon vodka|citron|bacardi limon/.test(k)) sour += /juice|sour/.test(k) ? 2 : 1;
        if (reFruit.test(k)) fruit += /juice|nectar|puree|berries|strawberr|raspberr/.test(k) ? 2 : 1;
      }
      if (reFresh.test(k)) fresh++;
      if (reWinter.test(k)) winter++;
      const a = abvOf(k);
      let ml = parseMl(i.measure);
      if (ml == null) ml = a >= .25 ? 45 : a > 0 ? 60 : reMixer.test(k) ? 100 : 0;
      if (a === 0 && !reMixer.test(k) && !/(oz|cl|ml|part|shot|cup)/i.test(i.measure || '')) ml = 0;
      if (garnish) ml = 0;
      vol += ml; alc += ml * a;
    }
    if (/\bhot\b|heat|warm|heiß|erhitz/.test(txt)) winter += 2;
    const abv = vol ? alc / vol : 0;
    const party = /Punch|Shot|Beer/.test(d.cat) || /pitcher|punch bowl/i.test(d.glass || '') || /\b(party|pitcher|punch bowl|batch|crowd)\b/.test(txt);
    return {
      sweet: sweet >= 2, sour: sour >= 2, strong: d.alc !== 'Non alcoholic' && abv >= .2,
      fruity: fruit >= 2, fresh: fresh >= 1 && winter < 2 && !/cream|coffee/.test(d.keys.join()),
      winter: winter >= 2 || /Coffee|Cocoa/.test(d.cat), party, abv
    };
  }
  function computeTools(d) {
    const txt = ((d.instr || '') + ' ' + (d.instrDE || '')).toLowerCase(), out = [];
    const add = id => { if (!out.includes(id)) out.push(id); };
    if (/shake|shaker|schüttel/.test(txt)) add('shaker');
    if (/strain|abseih|sieb/.test(txt)) add('strainer');
    if (/\bstir|rühr|mixing glass|rührglas/.test(txt)) add('spoon');
    if (/mixing glass|rührglas/.test(txt)) add('mixglass');
    if (/blend|pürier|mixer/.test(txt)) add('blender');
    if (/muddle|crush(?!ed ice)|zerdrück|zerstoß|stößel/.test(txt)) add('muddler');
    if (/layer|float|schicht/.test(txt)) add('spoon');
    if (/\brim\b|glasrand/.test(txt)) add('rim');
    if (/\bhot\b|heat|boil|erhitz|koch/.test(txt)) add('pot');
    if (/grate|reib/.test(txt)) add('grater');
    if (d.ings.some(i => /oz|cl|ml|shot|jigger|part/i.test(i.measure))) add('jigger');
    return out;
  }
  const TOOL_ICON = { shaker: '🍶', strainer: '🥢', spoon: '🥄', mixglass: '🫙', blender: '🌀', muddler: '🪵', rim: '🧂', pot: '♨️', grater: '🧀', jigger: '⚖️' };
  function glassEmoji(g) {
    g = key(g);
    if (/champagne|flute|coupe/.test(g)) return '🥂';
    if (/wine|balloon/.test(g)) return '🍷';
    if (/coffee|irish|cup/.test(g)) return '☕';
    if (/beer|pint|stein/.test(g)) return '🍺';
    if (/old-fashioned|whiskey|shot|snifter|cordial|rocks/.test(g)) return '🥃';
    if (/highball|collins|hurricane|jar|pitcher|punch|copper/.test(g)) return '🥤';
    return '🍸';
  }

  // Alkoholfreie Version eines Drinks (oder null, wenn es keine sinnvolle Alternative gibt)
  function afVersion(d) {
    if (d._af !== undefined) return d._af;
    if (d.alc === 'Non alcoholic') return (d._af = { ings: d.ings, changed: false });
    let changed = false, ok = true;
    const ings = d.ings.map(i => {
      const k = key(i.name);
      if (abvOf(k) === 0) return i;
      const sub = AF_SUBS.find(([re]) => re.test(k));
      if (!sub) { ok = false; return i; }
      changed = true;
      return { name: sub[1], measure: i.measure, orig: i.name };
    });
    return (d._af = ok ? { ings, changed } : null);
  }
  const effIngs = d => state.af ? (afVersion(d)?.ings || d.ings) : d.ings;
  const visible = d => !state.af || !!afVersion(d);

  // Farbe des Drinks (für das Glas)
  const COLOR_HINTS = [
    [/blue curacao/, '#2f8fe0'], [/grenadine|cherry|cranberr|raspberr|strawberr|campari|red wine|chambord|cassis|pomegranate/, '#d7354c'],
    [/aperol/, '#f2693a'], [/midori|melon|green creme|green chartreuse|creme de menthe/, '#5cc46a'],
    [/orange juice|mango|peach|passion|apricot/, '#f6a73b'], [/pineapple/, '#f3d35a'],
    [/coffee|kahlua|espresso|cola|coke|stout|guinness|chocolate|cocoa|dark rum|tia maria/, '#5a3422'],
    [/cream|milk|baileys|irish cream|advocaat|coconut|egg|ice-cream|yoghurt/, '#efe2cc'],
    [/whiske?y|bourbon|scotch|brandy|cognac|rum|sweet vermouth|amaretto|beer|lager|ale|cider|tea/, '#c98a36'],
    [/tomato|clamato/, '#c8412e'], [/grapefruit/, '#f39a8a'], [/lime|mint/, '#cfe7a0'], [/lemon|tonic|soda|gin|vodka|tequila|champagne|prosecco|wine/, '#f1ecc2']
  ];
  function colorFromIngs(d) {
    for (const i of d.ings) {
      const k = key(i.name); if (reGarnish.test(i.measure || '')) continue;
      for (const [re, c] of COLOR_HINTS) if (re.test(k)) return c;
    }
    return '#e9a15b';
  }
  const colorCache = new Map();
  function sampleImageColor(src) {
    return new Promise(res => {
      if (!src) return res(null);
      if (colorCache.has(src)) return res(colorCache.get(src));
      const img = new Image(); img.crossOrigin = 'anonymous';
      const tm = setTimeout(() => res(null), 1500);
      img.onload = () => {
        clearTimeout(tm);
        try {
          const c = document.createElement('canvas'); c.width = c.height = 24;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
          const px = x.getImageData(6, 8, 12, 12).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < px.length; i += 4) {
            const R = px[i], G = px[i + 1], B = px[i + 2], w = (Math.max(R, G, B) - Math.min(R, G, B)) / 255 + .05;
            r += R * w; g += G * w; b += B * w; n += w;
          }
          const col = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
          colorCache.set(src, col); res(col);
        } catch { res(null); }
      };
      img.onerror = () => { clearTimeout(tm); res(null); };
      img.src = src;
    });
  }

  // ---------- Mengen hochrechnen ----------
  const NUM = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:[.,]\d+)?)/g;
  const numVal = (a, b, c, d, e, f) => a ? +a + b / c : d ? d / e : parseFloat(String(f).replace(',', '.'));
  const FR = [[0, ''], [.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾'], [1, '']];
  function fmtFrac(v) {
    let w = Math.floor(v), best = FR[0];
    const r = v - w;
    for (const f of FR) if (Math.abs(f[0] - r) < Math.abs(best[0] - r)) best = f;
    if (best[0] === 1) { w++; best = FR[0]; }
    if (v > 0 && !w && !best[1]) return '¼';
    return (w ? String(w) : '') + best[1];
  }
  function fmtDec(v) {
    const r = v >= 3 ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;
    return lang === 'de' ? String(r).replace('.', ',') : String(r);
  }
  function scaleMeasure(m, n) {
    m = String(m || '').trim(); if (!m) return '';
    if (/\boz\b|ounces?/i.test(m)) {
      return m.replace(new RegExp('(?:' + NUM.source + ')\\s*(?:oz|ounces?)\\b\\.?', 'gi'), (_, a, b, c, d, e, f) => fmtDec(numVal(a, b, c, d, e, f) * 3 * n) + ' cl');
    }
    if (n === 1) return m;
    const dec = /\b(cl|ml|dl|l|g|kg)\b/i.test(m);
    return m.replace(NUM, (_, a, b, c, d, e, f) => { const v = numVal(a, b, c, d, e, f) * n; return dec || Number.isInteger(v) ? fmtDec(v) : fmtFrac(v); });
  }

  // ---------- Daten laden ----------
  function normalize(r) {
    const ings = [];
    for (let i = 1; i <= 15; i++) {
      const n = r['strIngredient' + i];
      if (n && n.trim()) ings.push({ name: n.trim(), measure: (r['strMeasure' + i] || '').trim() });
    }
    return {
      id: r.idDrink, name: r.strDrink, img: r.strDrinkThumb, cat: r.strCategory || '', alc: r.strAlcoholic || '',
      glass: r.strGlass || '', instrDE: r.strInstructionsDE || '', instr: r.strInstructions || '', ings
    };
  }
  async function fetchJSON(url, tries = 3) {
    for (let i = 0; i < tries; i++) {
      try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* nochmal */ }
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
    throw new Error('net');
  }
  async function loadDB() {
    const cached = load(K.db, null);
    if (cached && cached.drinks && cached.drinks.length && Date.now() - cached.t < DB_TTL) return cached.drinks;
    const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const out = new Map(); let done = 0, failed = 0;
    const worker = async () => {
      while (letters.length) {
        const l = letters.shift();
        try { const j = await fetchJSON(API + 'search.php?f=' + l); (Array.isArray(j.drinks) ? j.drinks : []).forEach(r => out.set(r.idDrink, normalize(r))); }
        catch { failed++; }
        done++; state.progress = done / 36; renderProgress();
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    const drinks = [...out.values()];
    if (!drinks.length) { if (cached && cached.drinks) return cached.drinks; throw new Error('offline'); }
    if (!failed) save(K.db, { t: Date.now(), drinks });
    return drinks;
  }

  function prepare(d) {
    d.keys = d.ings.map(i => key(i.name));
    d.taste = computeTaste(d);
    if (d.own && d.tags && d.tags.length) {
      for (const tg of ['sweet', 'sour', 'strong', 'fruity', 'fresh', 'winter', 'party']) d.taste[tg] = d.tags.includes(tg);
    }
    d.search = (d.name + ' ' + d.ings.map(i => i.name + ' ' + (DE[key(i.name)] || '')).join(' ')).toLowerCase();
    return d;
  }
  let ownCache = null;
  function ownDrinks() {
    if (!ownCache) ownCache = state.own.map(o => prepare({ ...o, own: true, cat: 'Eigenes' }));
    return ownCache;
  }
  const allDrinks = () => [...ownDrinks(), ...state.drinks];
  const pool = () => allDrinks().filter(visible);
  const findDrink = id => allDrinks().find(x => x.id === id);

  function rebuildIngIndex() {
    ownCache = null;
    const m = new Map();
    for (const d of allDrinks()) for (const i of d.ings) {
      const k = key(i.name);
      const e = m.get(k) || { name: i.name, count: 0, db: false };
      e.count++; if (!d.own) e.db = true; m.set(k, e);
    }
    AF_SUBS.forEach(([, s]) => { if (s && !m.has(key(s))) m.set(key(s), { name: s, count: 0, db: false }); });
    state.bar.forEach(k => { if (!m.has(k)) m.set(k, { name: cap(k), count: 0, db: false }); });
    state.ingIndex = m;
    $('#ing-datalist').innerHTML = [...m.values()].sort((a, b) => b.count - a.count)
      .map(e => `<option value="${esc(ingName(e.name))}"></option>`).join('');
  }

  // ---------- Matching ----------
  const has = k => state.bar.has(k) || (equivOf.get(k) || []).some(x => state.bar.has(x));
  function status(d) {
    const seen = new Set(), missing = [];
    for (const i of effIngs(d)) {
      const k = key(i.name); if (seen.has(k)) continue; seen.add(k);
      if (!has(k)) missing.push(i.name);
    }
    return { missing, total: seen.size, have: seen.size - missing.length };
  }
  const canMake = d => !status(d).missing.length;
  function passTags(d) {
    for (const tg of state.tags) {
      if (tg === 'fav') { if (!state.favs.has(d.id)) return false; }
      else if (tg === 'made') { if (!state.hist.some(h => h.id === d.id)) return false; }
      else if (tg === 'strong') { if (state.af || !d.taste.strong) return false; }
      else if (!d.taste[tg]) return false;
    }
    return true;
  }
  const TAGS = [['fav', '♥'], ['made', '🕘'], ['sweet', '🍬'], ['sour', '🍋'], ['strong', '🔥'], ['fruity', '🍓'], ['fresh', '🧊'], ['winter', '❄️'], ['party', '🎉']];
  function renderTagBars() {
    $$('.tagfilter').forEach(box => {
      box.innerHTML = TAGS.filter(([tg]) => !(tg === 'strong' && state.af))
        .map(([tg, e]) => `<button data-t="${tg}" class="${state.tags.has(tg) ? 'on' : ''}">${e} ${esc(t('tag_' + tg))}</button>`).join('');
    });
    const ft = $('#f-tags');
    const sel = new Set($$('button.on', ft).map(b => b.dataset.t));
    ft.innerHTML = TAGS.slice(2).map(([tg, e]) => `<button type="button" data-t="${tg}" class="${sel.has(tg) ? 'on' : ''}">${e} ${esc(t('tag_' + tg))}</button>`).join('');
  }

  // ---------- Karten ----------
  const imgSrc = (d, size) => !d.img ? '' : d.own || d.img.startsWith('data:') ? d.img : size ? `${d.img}/${size}` : d.img;
  function tasteLabels(d) {
    return ['sweet', 'sour', 'strong', 'fruity', 'fresh', 'winter', 'party']
      .filter(tg => d.taste[tg] && !(tg === 'strong' && state.af)).map(tg => t('tag_' + tg).toLowerCase());
  }
  const phHTML = () => `<div class="ph"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 12h36L32 34 14 12Zm18 22v16m-9 0h18"/></svg></div>`;
  window.hbImgErr = img => {
    if (/\/(medium|small|preview)$/.test(img.src)) { img.src = img.src.replace(/\/(medium|small|preview)$/, ''); return; }
    const ph = document.createElement('div'); ph.className = 'ph';
    ph.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 12h36L32 34 14 12Zm18 22v16m-9 0h18"/></svg>';
    img.replaceWith(ph);
  };
  function cardHTML(d) {
    const st = status(d);
    const note = state.notes[d.id];
    const af = state.af && afVersion(d)?.changed;
    const meta = [d.alc === 'Non alcoholic' ? t('noAlc') : catName(d.cat), ...tasteLabels(d).slice(0, 2)].filter(Boolean).join(' · ');
    let foot;
    if (!st.missing.length) foot = `<span class="pill ok">✓ ${esc(t('canMix'))}</span>`;
    else {
      const pct = Math.round(st.have / st.total * 100);
      const bar = `<div class="prog" title="${st.have}/${st.total}"><div style="--p:${pct}%"></div></div>`;
      if (st.missing.length <= 2) {
        foot = `${bar}<div class="miss-row"><span class="pill miss">${esc(t('missing'))}: ${st.missing.map(m => esc(ingName(m))).join(', ')}</span>` +
          (st.missing.length === 1 && !state.guest ? `<button class="quick-add" data-add="${esc(st.missing[0])}">+ ${esc(t('gotIt'))}</button>` : '') + `</div>`;
      } else foot = `${bar}<span class="pill miss many">${esc(t('haveOf', { a: st.have, b: st.total }))}</span>`;
    }
    const src = imgSrc(d, 'medium');
    return `<article class="card" tabindex="0" data-id="${esc(d.id)}">
      <div class="card-img" style="--dc:${colorFromIngs(d)}">${src ? `<img src="${esc(src)}" alt="${esc(d.name)}" loading="lazy" onerror="hbImgErr(this)">` : phHTML(d)}<span class="shine"></span></div>
      <div class="badges">${d.own ? `<span class="own-badge">${esc(t('ownBadge'))}</span>` : ''}${af ? '<span class="af-badge">0,0 %</span>' : ''}</div>
      <button class="fav ${state.favs.has(d.id) ? 'on' : ''}" data-fav="${esc(d.id)}" aria-label="${esc(t('tag_fav'))}">${icon.heart}</button>
      <div class="card-body"><h3>${esc(d.name)}</h3><p class="meta">${note?.r ? `<span class="stars-mini">${'★'.repeat(note.r)}</span> ` : ''}${esc(meta)}</p>${foot}</div>
    </article>`;
  }
  // FLIP-Animation beim Neusortieren
  function renderGrid(el, list) {
    const before = new Map();
    if (!reduceMotion) $$('.card', el).forEach(c => before.set(c.dataset.id, c.getBoundingClientRect()));
    el.innerHTML = list.map(cardHTML).join('');
    if (!reduceMotion && before.size) {
      $$('.card', el).forEach((c, i) => {
        const old = before.get(c.dataset.id), now = c.getBoundingClientRect();
        if (old) {
          const dx = old.left - now.left, dy = old.top - now.top;
          if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
        } else if (now.top < innerHeight + 200) {
          c.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: Math.min(i, 12) * 25, easing: 'ease-out', fill: 'backwards' });
        }
      });
    }
    attachTilt(el);
  }

  // 3D-Kippen
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function attachTilt(root) {
    if (reduceMotion) return;
    if (finePointer) $$('.card', root).forEach(c => {
      if (c._tilt) return; c._tilt = true;
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.transform = `perspective(700px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg) translateY(-3px)`;
        c.style.setProperty('--gx', `${(x + .5) * 100}%`); c.style.setProperty('--gy', `${(y + .5) * 100}%`);
        c.classList.add('tilting');
      });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; c.classList.remove('tilting'); });
    });
    else scrollTilt();
  }
  let scrollTicking = false;
  function scrollTilt() {
    if (scrollTicking) return; scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      const h = innerHeight;
      $$('.view.on .grid .card').forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.bottom < 0 || r.top > h) return;
        const p = (r.top + r.height / 2) / h - .5;
        c.style.transform = `perspective(800px) rotateX(${(p * 10).toFixed(2)}deg)`;
      });
    });
  }
  if (!finePointer && !reduceMotion) addEventListener('scroll', scrollTilt, { passive: true });

  // ---------- Saison ----------
  function season(now = new Date()) {
    const m = now.getMonth() + 1, d = now.getDate();
    const ks = x => x.keys.join(' ');
    if ((m === 12 && d >= 27) || (m === 1 && d <= 2)) return { id: 'newyear', test: x => /champagne|prosecco|sparkling/.test(ks(x)) || x.taste.party };
    if (m === 12) return { id: 'xmas', test: x => x.taste.winter || /cinnamon|nutmeg|cloves|cranberr|eggnog|advocaat|peppermint/.test(ks(x)) };
    if (m === 10 && d >= 15) return { id: 'halloween', test: x => /zombie|vampire|witch|blood|devil|corpse|ghost|black|monkey|pumpkin|grave|death/i.test(x.name) };
    if (m === 2 && d >= 7 && d <= 14) return { id: 'valentine', test: x => /love|kiss|heart|cupid|romeo|angel|pink|rose|passion/i.test(x.name) || /strawberr|raspberr|chambord|grenadine/.test(ks(x)) };
    if (m <= 2 || m === 11) return { id: 'winter', test: x => x.taste.winter };
    if (m >= 6 && m <= 8) return { id: 'summer', test: x => x.taste.fresh || x.taste.fruity };
    if (m >= 3 && m <= 5) return { id: 'spring', test: x => x.taste.fresh && !x.taste.winter };
    return { id: 'autumn', test: x => /apple|cider|pear|cinnamon|whiske?y|bourbon|maple/.test(ks(x)) };
  }

  // ---------- Views ----------
  function renderProgress() { const p = $('.progress div'); if (p) p.style.width = Math.round(state.progress * 100) + '%'; }
  const loadingHTML = () => `<p class="loading-note">${esc(t('loading'))}</p>
      <div class="progress"><div style="width:${Math.round(state.progress * 100)}%"></div></div>
      <div class="grid">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
  const errorHTML = () => `<div class="empty"><div class="big">📡</div><h3>${esc(t('errTitle'))}</h3><p>${esc(t('errText'))}</p><button class="btn" id="retry">${esc(t('retry'))}</button></div>`;
  const sortByName = (a, b) => a.name.localeCompare(b.name, lang);

  function unlockList(limit) {
    const gain = new Map();
    pool().forEach(d => { const s = status(d); if (s.missing.length === 1) { const k = key(s.missing[0]); gain.set(k, (gain.get(k) || 0) + 1); } });
    return [...gain.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, n]) => ({ k, n, e: state.ingIndex.get(k) || { name: k } }));
  }

  function renderMix() {
    const box = $('#mix-content');
    if (state.loading && !state.own.length) { box.innerHTML = loadingHTML(); $('#mix-lead').textContent = ''; return; }
    if (state.loadErr && !state.drinks.length && !state.own.length) { box.innerHTML = errorHTML(); return; }
    const drinks = pool();
    const sts = new Map(drinks.map(d => [d.id, status(d)]));
    const can = drinks.filter(d => !sts.get(d.id).missing.length);
    const almost = drinks.filter(d => sts.get(d.id).missing.length === 1);
    const canF = can.filter(passTags).sort(sortByName), almostF = almost.filter(passTags).sort(sortByName);
    const tagNote = state.tags.size ? ` ${t('filtered')}` : '';
    let html = '';

    // Saison-Tipp
    const s = season();
    const seasonal = drinks.filter(s.test).filter(passTags)
      .sort((a, b) => sts.get(a.id).missing.length - sts.get(b.id).missing.length || sortByName(a, b)).slice(0, 10);
    const seasonHTML = seasonal.length ? `<section class="season season-${s.id}">
        <div class="season-head"><span class="season-emoji">${t('season_' + s.id + '_e')}</span><div><h2>${esc(t('season_' + s.id))}</h2><p>${esc(t('season_' + s.id + '_t'))}</p></div></div>
        <div class="hscroll" id="grid-season"></div></section>` : '';

    if (!state.bar.size) {
      $('#mix-title').textContent = t('mixTitle0');
      $('#mix-lead').textContent = t('mixLead0');
      box.innerHTML = `<div class="empty"><div class="big">🍋🥃🧊</div><h3>${esc(t('emptyBarTitle'))}</h3><p>${esc(t('emptyBarText'))}</p>
        <a class="btn" href="#bar">${esc(t('addIngs'))}</a></div>` + seasonHTML;
      if (seasonal.length) renderGrid($('#grid-season'), seasonal);
      return;
    }
    $('#mix-title').textContent = can.length ? t('mixTitleN', { n: can.length }) : t('mixTitleNone');
    $('#mix-lead').textContent = (can.length ? t('mixLeadN', { n: state.bar.size }) : t('mixLeadNone', { n: state.bar.size })) +
      (state.af ? ' ' + t('afActive') : '') + (state.loading ? ' ' + t('stillLoading') : '');

    if (can.length) {
      html += `<h2 class="section-title">${esc(t('readyNow'))} <span class="count">${canF.length}${tagNote}</span></h2><div class="grid" id="grid-can"></div>`;
      if (!canF.length) html += `<p class="hint">${esc(t('noneForFilter'))}</p>`;
    }
    html += seasonHTML;
    const unlock = unlockList(8);
    if (unlock.length) {
      html += `<h2 class="section-title">${esc(t('whatToBuy'))}</h2><p class="hint">${esc(t('whatToBuyHint'))}</p>
        <div class="chips">${unlock.map(u => `<button class="chip add unlock" data-add="${esc(u.e.name)}">${ingImg(u.e)}<span>${esc(ingName(u.e.name))}</span><span class="gain">+${u.n}</span></button>`).join('')}</div>`;
    }
    if (almost.length) html += `<h2 class="section-title">${esc(t('almost'))} <span class="count">${almostF.length}${tagNote}</span></h2>
      <p class="hint">${esc(t('almostHint'))}</p><div class="grid" id="grid-almost"></div>`;
    // Verlauf
    const seen = new Set(), recent = [];
    for (let i = state.hist.length - 1; i >= 0 && recent.length < 10; i--) {
      const h = state.hist[i]; if (seen.has(h.id)) continue; seen.add(h.id);
      const d = findDrink(h.id); if (d) recent.push({ d, h });
    }
    if (recent.length) html += `<h2 class="section-title">${esc(t('history'))} <span class="count">${state.hist.length}×</span></h2>
      <div class="history">${recent.map(({ d, h }) => `<button class="hist-item" data-open="${esc(d.id)}">
        ${imgSrc(d, 'preview') ? `<img src="${esc(imgSrc(d, 'preview'))}" alt="" loading="lazy">` : '<span class="ph">🍸</span>'}
        <span><strong>${esc(d.name)}</strong><small>${esc(fmtDate(h.t))} · ${state.hist.filter(x => x.id === d.id).length}×</small></span></button>`).join('')}</div>`;
    box.innerHTML = html;
    if ($('#grid-can')) renderGrid($('#grid-can'), canF);
    if ($('#grid-season')) renderGrid($('#grid-season'), seasonal);
    if ($('#grid-almost')) renderGrid($('#grid-almost'), almostF.slice(0, 60));
  }

  function renderAll(keepShown) {
    const grid = $('#all-grid');
    if (!keepShown) state.shown = PAGE;
    if (state.loading && !state.drinks.length && !state.own.length) { grid.innerHTML = ''; $('#all-lead').textContent = t('loadingShort'); return; }
    let list = pool().map(d => ({ d, s: status(d) }));
    const q = key(state.query);
    if (q) list = list.filter(x => x.d.search.includes(q));
    if (state.filter === 'can') list = list.filter(x => !x.s.missing.length);
    if (state.filter === 'nonalc') list = list.filter(x => x.d.alc === 'Non alcoholic');
    if (state.filter === 'own') list = list.filter(x => x.d.own);
    list = list.filter(x => passTags(x.d));
    list.sort((a, b) => (state.bar.size ? a.s.missing.length - b.s.missing.length : 0) || sortByName(a.d, b.d));
    $('#all-lead').textContent = t('allLead', { n: pool().length, m: list.length }) + (state.bar.size ? ' · ' + t('sortedHint') : '') + (state.af ? ' · ' + t('afActiveShort') : '');
    if (!list.length) {
      const own = state.filter === 'own';
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><h3>${esc(t('nothing'))}</h3><p>${esc(own ? t('noOwn') : t('tryOther'))}</p>${own ? `<a class="btn" href="#new">${esc(t('createRecipe'))}</a>` : ''}</div>`;
      $('#all-more').hidden = true; return;
    }
    renderGrid(grid, list.slice(0, state.shown).map(x => x.d));
    $('#all-more').hidden = list.length <= state.shown;
  }

  function ingImg(e) {
    return e && e.db ? `<img src="${esc(ING_IMG(e.name))}" alt="" loading="lazy" onerror="this.outerHTML='<span class=noimg>🍶</span>'">` : '<span class="noimg">🍶</span>';
  }
  let lastAdded = null;
  function renderBar() {
    const chips = [...state.bar].map(k => state.ingIndex.get(k) || { name: cap(k) })
      .sort((a, b) => ingName(a.name).localeCompare(ingName(b.name), lang));
    $('#bar-count').textContent = state.bar.size;
    $('#bar-clear').hidden = !state.bar.size || !!state.guest;
    $('#bar-hint').hidden = !state.bar.size || !!state.guest;
    $('#bar-chips').innerHTML = chips.length ? chips.map(e => {
      const k = key(e.name), low = state.low.has(k);
      return `<span class="chip${k === lastAdded ? ' pop' : ''}${low ? ' low' : ''}" data-k="${esc(k)}">
        <button class="chip-main" data-low="${esc(k)}" title="${esc(t('lowToggle'))}">${ingImg(e)}<span>${esc(ingName(e.name))}</span>${low ? `<span class="low-tag">${esc(t('lowTag'))}</span>` : ''}</button>
        <button class="chip-x" data-remove="${esc(k)}" aria-label="${esc(t('remove'))}">${icon.x}</button></span>`;
    }).join('') : `<div class="empty-bar">${esc(t('emptyShelf'))}</div>`;
    lastAdded = null;
    // Was soll ich kaufen?
    const unlock = unlockList(6);
    $('#buy-box').innerHTML = unlock.length ? `<h2 class="sub">${esc(t('whatToBuy'))}</h2><p class="hint">${esc(t('whatToBuyHint'))}</p>
      <ol class="buy-list">${unlock.map((u, i) => `<li><span class="rank">${i + 1}</span>${ingImg(u.e)}<span class="buy-name">${esc(ingName(u.e.name))}<small>${esc(t('unlocks', { n: u.n }))}</small></span>
        <button class="btn-mini" data-shopadd="${esc(u.e.name)}" title="${esc(t('toShop'))}">🛒</button><button class="btn-mini" data-add="${esc(u.e.name)}">+ ${esc(t('gotIt'))}</button></li>`).join('')}</ol>` : '';
    const pop = [...state.ingIndex.entries()].filter(([k, e]) => e.db && !has(k)).sort((a, b) => b[1].count - a[1].count).slice(0, 36);
    $('#popular-chips').innerHTML = pop.length ? pop.map(([, e]) =>
      `<button class="chip add" data-add="${esc(e.name)}">${ingImg(e)}<span>${esc(ingName(e.name))}</span><span class="plus">+</span></button>`).join('')
      : `<p class="hint">${esc(state.loading ? t('loadingShort') : t('allPopular'))}</p>`;
  }
  function setBadge(view, n) {
    const a = $(`.nav a[data-view="${view}"]`); let b = $('.badge', a);
    if (!n) { b && b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'badge'; a.append(b); }
    if (b.textContent !== String(n)) { b.textContent = n; if (!reduceMotion) b.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' }); }
  }
  const updateBadges = () => {
    setBadge('mix', state.bar.size ? pool().filter(canMake).length : 0);
    setBadge('shop', state.shop.filter(x => !x.done).length);
  };

  // ---------- Einkaufsliste ----------
  function addToShop(forName, names) {
    let added = 0;
    for (const nm of names) {
      const k = key(nm);
      let it = state.shop.find(x => x.k === k);
      if (!it) { it = { k, name: nm, for: [], done: false }; state.shop.push(it); added++; }
      if (forName && !it.for.includes(forName)) it.for.push(forName);
    }
    saveShop(); updateBadges();
    return added;
  }
  function renderShop() {
    const box = $('#shop-content');
    if (!state.shop.length) {
      box.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>${esc(t('shopEmpty'))}</h3><p>${esc(t('shopEmptyText'))}</p><a class="btn" href="#mix">${esc(t('seeDrinks'))}</a></div>`;
      return;
    }
    const open = state.shop.filter(x => !x.done), done = state.shop.filter(x => x.done);
    const forTxt = x => [x.for.includes('__low') ? t('lowTag') : '', x.for.filter(f => f !== '__low').length ? t('forDrinks') + ' ' + x.for.filter(f => f !== '__low').join(', ') : ''].filter(Boolean).join(' · ');
    const row = x => `<li class="shop-item${x.done ? ' done' : ''}">
        <label><input type="checkbox" data-shop="${esc(x.k)}" ${x.done ? 'checked' : ''}><span class="box"></span>
        <span class="shop-txt"><strong>${esc(ingName(x.name))}</strong>${x.for.length ? `<small>${esc(forTxt(x))}</small>` : ''}</span></label>
        <button class="shop-del" data-shopdel="${esc(x.k)}" aria-label="${esc(t('remove'))}">${icon.x}</button></li>`;
    box.innerHTML = `<div class="shop-card"><ul class="shop-list">${open.map(row).join('')}${done.map(row).join('')}</ul>
        <div class="shop-actions">
          <button class="btn" id="shop-tobar" ${done.length ? '' : 'disabled'}>✓ ${esc(t('doneToBar', { n: done.length }))}</button>
          <button class="btn ghost" id="shop-share">${esc(t('shareList'))}</button>
          <button class="btn-text muted" id="shop-clear">${esc(t('clearList'))}</button>
        </div></div>`;
  }

  function renderCurrent() {
    const v = currentView();
    if (v === 'mix') renderMix();
    if (v === 'all') renderAll(true);
    if (v === 'bar') renderBar();
    if (v === 'shop') renderShop();
    updateBadges();
  }

  // ---------- Bar-Aktionen ----------
  function addIng(name) {
    const k = key(name); if (!k) return;
    if (state.bar.has(k)) { toast(t('alreadyIn', { x: ingName(name) })); return; }
    const before = pool().filter(canMake).length;
    state.bar.add(k); saveBar();
    if (!state.ingIndex.has(k)) state.ingIndex.set(k, { name: cap(name.trim()), count: 0, db: false });
    const it = state.shop.find(x => x.k === k); if (it) { it.done = true; saveShop(); }
    lastAdded = k;
    const diff = pool().filter(canMake).length - before;
    toast(diff > 0 ? t('addedNew', { x: ingName(name), n: diff }) : t('added', { x: ingName(name) }));
    renderCurrent();
  }
  function removeIng(k) {
    const chip = $(`#bar-chips .chip[data-k="${CSS.escape(k)}"]`);
    const done = () => { state.bar.delete(k); state.low.delete(k); saveBar(); saveLow(); renderCurrent(); };
    if (chip && !reduceMotion) chip.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }], { duration: 180, easing: 'ease-in' }).onfinish = done;
    else done();
  }
  function toggleLow(k) {
    if (state.guest) return;
    const e = state.ingIndex.get(k) || { name: cap(k) };
    if (state.low.has(k)) {
      state.low.delete(k);
      const it = state.shop.find(x => x.k === k);
      if (it) { it.for = it.for.filter(f => f !== '__low'); if (!it.for.length) state.shop = state.shop.filter(x => x !== it); saveShop(); }
      toast(t('lowOff', { x: ingName(e.name) }));
    } else {
      state.low.add(k); addToShop('__low', [e.name]);
      toast(t('lowOn', { x: ingName(e.name) }));
    }
    saveLow(); renderBar(); updateBadges();
  }

  // ---------- Zutaten-Suche ----------
  const input = $('#ing-input'), sug = $('#ing-suggest');
  let sel = -1, sugItems = [];
  function updateSuggest() {
    const q = key(input.value);
    if (!q) { sug.hidden = true; return; }
    const res = [];
    for (const [k, e] of state.ingIndex) {
      const de = key(DE[k] || '');
      const score = k.startsWith(q) || de.startsWith(q) ? 0 : k.includes(q) || de.includes(q) ? 1 : 9;
      if (score < 9) res.push({ k, e, score });
    }
    res.sort((a, b) => a.score - b.score || b.e.count - a.e.count);
    sugItems = res.slice(0, 10);
    const exact = sugItems.some(x => x.k === q || key(DE[x.k] || '') === q);
    if (!exact) sugItems.push({ k: q, e: { name: input.value.trim(), count: 0, db: false }, custom: true });
    sel = 0;
    sug.innerHTML = sugItems.map((x, i) => x.custom
      ? `<li role="option" data-i="${i}" aria-selected="${i === sel}"><span class="noimg">➕</span><span>${esc(t('addCustom', { x: x.e.name }))}</span></li>`
      : `<li role="option" data-i="${i}" aria-selected="${i === sel}" class="${has(x.k) ? 'have' : ''}">${ingImg(x.e)}<span>${esc(ingName(x.e.name))}${has(x.k) ? ' ✓' : ''}</span>${lang === 'de' && ingName(x.e.name) !== x.e.name ? `<span class="en">${esc(x.e.name)}</span>` : ''}</li>`).join('');
    sug.hidden = false;
  }
  function pick(i) {
    const x = sugItems[i]; if (!x) return;
    if (state.guest) { toast(t('guestNoEdit')); return; }
    addIng(x.e.name); input.value = ''; sug.hidden = true; input.focus();
  }
  input.addEventListener('input', updateSuggest);
  input.addEventListener('keydown', e => {
    if (sug.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
      $$('li', sug).forEach((li, i) => li.setAttribute('aria-selected', i === sel));
    } else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') sug.hidden = true;
  });
  sug.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(() => sug.hidden = true, 120));
  $('#bar-clear').addEventListener('click', () => {
    if (!confirm(t('confirmClearBar'))) return;
    state.bar.clear(); state.low.clear(); saveBar(); saveLow(); renderCurrent();
  });

  // ---------- Detail ----------
  const dlg = $('#detail');
  let lastLevel = null;
  function glassSVG() {
    return `<div class="glass-wrap" aria-hidden="true"><svg class="glass" viewBox="0 0 80 100">
      <defs><clipPath id="gclip"><path d="M14 10 L66 10 L58 86 Q57 92 50 92 L30 92 Q23 92 22 86 Z"/></clipPath></defs>
      <g clip-path="url(#gclip)">
        <rect class="liquid" x="0" y="100" width="80" height="100"/>
        <path class="wave" d="M0 0 Q10 -4 20 0 T40 0 T60 0 T80 0 T100 0 T120 0 V8 H0Z"/>
        <circle class="bub b1" cx="30" cy="88" r="1.8"/><circle class="bub b2" cx="46" cy="90" r="1.3"/><circle class="bub b3" cx="54" cy="88" r="2"/>
      </g>
      <path class="glass-line" d="M14 10 L66 10 L58 86 Q57 92 50 92 L30 92 Q23 92 22 86 Z"/>
      <path class="glass-shine" d="M20 16 L25 80"/>
    </svg><span class="glass-label"></span></div>`;
  }
  let glassRAF = 0;
  function animateGlass(color, frac, instant) {
    const svg = $('.glass', dlg); if (!svg) return;
    svg.style.setProperty('--liq', color);
    const level = 92 - (92 - 14) * frac;
    const liquid = $('.liquid', svg), wave = $('.wave', svg);
    const from = instant && lastLevel != null ? lastLevel : 100;
    lastLevel = level;
    cancelAnimationFrame(glassRAF);
    if (reduceMotion) { liquid.setAttribute('y', level); wave.setAttribute('transform', `translate(0 ${level - 4})`); return; }
    const dur = instant ? 400 : 1100 + frac * 500, start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      const y = from - (from - level) * e;
      liquid.setAttribute('y', y.toFixed(2));
      wave.setAttribute('transform', `translate(${(-(now / 25) % 40).toFixed(2)} ${(y - 4).toFixed(2)})`);
      if (dlg.open) glassRAF = requestAnimationFrame(step);
    };
    glassRAF = requestAnimationFrame(step);
  }
  function openDetail(id, quiet) {
    const d = findDrink(id); if (!d) return;
    const st = status(d);
    const big = imgSrc(d);
    const instr = lang === 'de' ? (d.instrDE || d.instr) : (d.instr || d.instrDE);
    const af = state.af ? afVersion(d) : null;
    const ings = af ? af.ings : d.ings;
    const tags = [catName(d.cat), af?.changed ? t('afVersion') : d.alc === 'Non alcoholic' ? t('noAlc') : d.alc === 'Optional alcohol' ? t('optAlc') : t('withAlc'), ...tasteLabels(d)].filter(Boolean);
    const tools = computeTools(d);
    const note = state.notes[d.id] || {};
    const made = state.hist.filter(h => h.id === d.id);
    const seen = new Set();
    dlg.innerHTML = `<button class="close" aria-label="${esc(t('close'))}">${icon.x}</button>
      <div class="detail-inner">
        <div class="detail-img" style="--dc:${colorFromIngs(d)}">${big ? `<img src="${esc(big)}" alt="${esc(d.name)}" onerror="hbImgErr(this)">` : phHTML(d)}</div>
        <div class="detail-body">
          <div class="detail-head">${glassSVG()}<div><h2>${esc(d.name)}</h2>
            <p class="meta">${st.missing.length ? esc(t('youMiss', { a: st.missing.length, b: st.total })) : '✓ ' + esc(t('youHaveAll'))}</p></div></div>
          <div class="tagline">${tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>
          <div class="need">
            <span class="need-label">${esc(t('youNeed'))}</span>
            ${d.glass ? `<span class="need-item"><span class="need-ico">${glassEmoji(d.glass)}</span>${esc(glassName(d.glass))}</span>` : ''}
            ${tools.map(x => `<span class="need-item"><span class="need-ico">${TOOL_ICON[x]}</span>${esc(t('tool_' + x))}</span>`).join('')}
          </div>
          <div class="ing-head"><h4>${esc(t('ingredients'))}</h4>
            <div class="stepper"><button data-pers="-1" aria-label="−">−</button>
            <span><b>${state.persons}</b> ${esc(state.persons === 1 ? t('person') : t('persons'))}</span><button data-pers="1" aria-label="+">+</button></div></div>
          <ul class="ing-list">${ings.map(i => {
            const k = key(i.name); const dup = seen.has(k); seen.add(k); const ok = has(k);
            return `<li class="${ok ? 'have' : 'missing'}"><span class="st">${ok ? '✓' : '!'}</span>
              <span class="name">${esc(ingName(i.name))}${i.orig ? `<small class="instead">${esc(t('insteadOf', { x: ingName(i.orig) }))}</small>` : ''}</span>
              ${!ok && !dup && !state.guest ? `<button class="add-one" data-add="${esc(i.name)}">+ ${esc(t('gotIt'))}</button>` : ''}
              <span class="measure">${esc(scaleMeasure(i.measure, state.persons))}</span></li>`;
          }).join('')}</ul>
          ${st.missing.length ? `<button class="btn shop-btn" data-toshop="${esc(d.id)}">🛒 ${esc(t('missingToShop', { n: st.missing.length }))}</button>` : ''}
          ${instr ? `<h4>${esc(t('preparation'))}</h4><p class="instr">${esc(instr)}</p>` : ''}
          ${af?.changed ? `<p class="hint af-hint">🌱 ${esc(t('afHint'))}</p>` : ''}
          <div class="rate-box">
            <h4>${esc(t('yourRating'))}</h4>
            <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-rate="${n}" class="${note.r >= n ? 'on' : ''}" aria-label="${n}/5">★</button>`).join('')}</div>
            <textarea id="note-text" rows="2" maxlength="1000" placeholder="${esc(t('notePh'))}">${esc(note.n || '')}</textarea>
          </div>
          <div class="made-row">
            <button class="btn" data-made="${esc(d.id)}">🍹 ${esc(t('madeToday'))}</button>
            <span class="made-info">${made.length ? esc(t('madeInfo', { n: made.length, d: fmtDate(made[made.length - 1].t) })) : ''}</span>
          </div>
          <div class="detail-actions">
            <button class="btn ghost" data-fav="${esc(d.id)}">${state.favs.has(d.id) ? '♥ ' + esc(t('isFav')) : '♡ ' + esc(t('makeFav'))}</button>
            <button class="btn ghost" data-sharedrink="${esc(d.id)}">↗ ${esc(t('share'))}</button>
            ${d.own && !state.guest ? `<button class="btn ghost" data-edit="${esc(d.id)}">${esc(t('edit'))}</button><button class="btn danger" data-del="${esc(d.id)}">${esc(t('delete'))}</button>` : ''}
          </div>
        </div>
      </div>`;
    const wasOpen = dlg.open && dlg.dataset.id === id, scroll = dlg.scrollTop;
    dlg.dataset.id = id;
    if (!dlg.open) { dlg.showModal(); lastLevel = null; }
    dlg.scrollTop = wasOpen ? scroll : 0;
    const frac = st.total ? st.have / st.total : 1;
    $('.glass-label', dlg).textContent = `${st.have}/${st.total}`;
    animateGlass(colorFromIngs(d), frac, quiet && wasOpen);
    sampleImageColor(imgSrc(d, 'preview')).then(c => { if (c && dlg.open && dlg.dataset.id === id) $('.glass', dlg)?.style.setProperty('--liq', c); });
    let nt;
    $('#note-text', dlg).addEventListener('input', e => {
      clearTimeout(nt); nt = setTimeout(() => { state.notes[id] = { ...(state.notes[id] || {}), n: e.target.value }; saveNotes(); }, 300);
    });
  }
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.close')) dlg.close(); });
  dlg.addEventListener('close', () => { state.persons = 1; cancelAnimationFrame(glassRAF); renderCurrent(); });

  // ---------- Teilen ----------
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const baseURL = () => location.href.split('#')[0];
  function shareOrCopy(text, url) {
    if (navigator.share) return navigator.share(url ? { text, url } : { text }).catch(() => { });
    const full = url ? `${text}\n${url}` : text;
    (navigator.clipboard ? navigator.clipboard.writeText(full) : Promise.reject()).then(() => toast(t('copied')), () => prompt(t('copyManual'), url || text));
  }
  const shareDlg = $('#share');
  function openShareBar() {
    shareDlg.innerHTML = `<button class="close" aria-label="${esc(t('close'))}">${icon.x}</button>
      <h2>${esc(t('shareBarTitle'))}</h2><p class="hint">${esc(t('shareBarHint'))}</p>
      <label class="field"><span>${esc(t('yourName'))}</span><input id="share-name" maxlength="30" placeholder="${esc(t('yourNamePh'))}"></label>
      <label class="check"><input type="checkbox" id="share-bar" checked> ${esc(t('shareIncBar', { n: state.bar.size }))}</label>
      <label class="check"><input type="checkbox" id="share-fav" ${state.favs.size ? 'checked' : ''}> ${esc(t('shareIncFav', { n: state.favs.size }))}</label>
      <div class="form-actions"><button class="btn" id="share-go">↗ ${esc(t('createLink'))}</button></div>`;
    shareDlg.showModal();
  }
  shareDlg.addEventListener('click', e => {
    if (e.target === shareDlg || e.target.closest('.close')) return shareDlg.close();
    if (e.target.closest('#share-go')) {
      const p = { v: 1, n: $('#share-name').value.trim().slice(0, 30) };
      if ($('#share-bar').checked) p.b = [...state.bar];
      if ($('#share-fav').checked) {
        p.f = [...state.favs].filter(id => !String(id).startsWith('own-'));
        p.o = state.own.filter(o => state.favs.has(o.id)).map(o => ({ ...o, img: /^https?:/.test(o.img) ? o.img : '' }));
      }
      const url = baseURL() + '#s=' + b64e(JSON.stringify(p));
      shareDlg.close();
      shareOrCopy(p.n ? t('shareText', { n: p.n }) : t('shareTextAnon'), url);
    }
  });
  function shareDrink(id) {
    const d = findDrink(id); if (!d) return;
    if (d.own) {
      const o = state.own.find(x => x.id === id);
      const url = baseURL() + '#r=' + b64e(JSON.stringify({ ...o, img: /^https?:/.test(o.img) ? o.img : '' }));
      shareOrCopy(t('shareDrinkText', { x: d.name }), url);
    } else shareOrCopy(t('shareDrinkText', { x: d.name }), baseURL() + '#d=' + encodeURIComponent(id));
  }
  // Rezepte aus fremden Links nur bereinigt übernehmen
  const cleanRecipe = o => ({
    id: String(o.id || 'own-' + Date.now().toString(36)).slice(0, 40), name: String(o.name || '').slice(0, 80),
    ings: (Array.isArray(o.ings) ? o.ings : []).slice(0, 20).map(i => ({ name: String(i.name || '').slice(0, 60), measure: String(i.measure || '').slice(0, 30) })).filter(i => i.name),
    img: /^https?:\/\//.test(o.img || '') ? String(o.img).slice(0, 500) : '', alc: o.alc === 'Non alcoholic' ? 'Non alcoholic' : 'Alcoholic',
    glass: String(o.glass || '').slice(0, 40), instr: String(o.instr || '').slice(0, 2000), instrDE: '',
    tags: (Array.isArray(o.tags) ? o.tags : []).filter(x => TAGS.some(([tg]) => tg === x))
  });
  function enterGuest(p) {
    const own = (Array.isArray(p.o) ? p.o : []).map(cleanRecipe).filter(o => o.name && o.ings.length);
    const g = {
      name: String(p.n || '').slice(0, 30), realBar: state.bar, realFavs: state.favs, realOwn: state.own,
      bar: (Array.isArray(p.b) ? p.b : []).map(key).filter(Boolean).slice(0, 400), favs: (Array.isArray(p.f) ? p.f : []).map(String).slice(0, 400), own
    };
    state.guest = g;
    state.bar = new Set(g.bar);
    state.favs = new Set([...g.favs, ...own.map(o => o.id)]);
    state.own = [...g.realOwn, ...own.filter(o => !g.realOwn.some(x => x.id === o.id))];
    rebuildIngIndex(); renderGuestBanner();
  }
  function leaveGuest(mode) {
    const g = state.guest; if (!g) return;
    state.bar = g.realBar; state.favs = g.realFavs; state.own = g.realOwn;
    state.guest = null;
    if (mode === 'merge') g.bar.forEach(k => state.bar.add(k));
    if (mode === 'merge' || mode === 'favs') {
      g.favs.forEach(id => state.favs.add(id));
      g.own.forEach(o => { if (!state.own.some(x => x.id === o.id)) state.own.push(o); state.favs.add(o.id); });
    }
    saveBar(); saveFavs(); saveOwn();
    rebuildIngIndex(); renderGuestBanner(); renderCurrent();
    if (mode) toast(t('imported'));
  }
  function renderGuestBanner() {
    const b = $('#guest-banner'), g = state.guest;
    b.hidden = !g; if (!g) { b.innerHTML = ''; return; }
    b.innerHTML = `<div class="guest-inner"><span>👀 ${esc(g.name ? t('guestOf', { n: g.name }) : t('guestAnon'))} · ${esc(t('guestCounts', { a: g.bar.length, b: g.favs.length + g.own.length }))}</span>
      <div class="guest-actions">
        ${g.bar.length ? `<button class="btn-mini" data-guest="merge">${esc(t('guestMerge'))}</button>` : ''}
        ${g.favs.length + g.own.length ? `<button class="btn-mini" data-guest="favs">${esc(t('guestFavs'))}</button>` : ''}
        <button class="btn-mini ghost" data-guest="leave">${esc(t('guestLeave'))}</button></div></div>`;
  }
  $('#guest-banner').addEventListener('click', e => {
    const b = e.target.closest('[data-guest]'); if (!b) return;
    leaveGuest(b.dataset.guest === 'leave' ? null : b.dataset.guest);
  });
  // Links wie #s=…, #d=…, #r=… auswerten
  let pendingDrink = null;
  function handleIncoming() {
    const h = location.hash;
    try {
      if (h.startsWith('#s=')) { if (state.guest) leaveGuest(null); enterGuest(JSON.parse(b64d(h.slice(3)))); history.replaceState(null, '', '#mix'); }
      else if (h.startsWith('#d=')) { pendingDrink = decodeURIComponent(h.slice(3)); history.replaceState(null, '', '#all'); }
      else if (h.startsWith('#r=')) {
        const o = cleanRecipe(JSON.parse(b64d(h.slice(3))));
        if (o.name && o.ings.length) {
          if (!state.own.some(x => x.id === o.id)) { state.own.unshift(o); saveOwn(); toast(t('recipeImported')); }
          pendingDrink = o.id;
        }
        history.replaceState(null, '', '#all');
      }
    } catch { toast(t('badLink')); history.replaceState(null, '', '#mix'); }
  }

  // ---------- Barcode-Scanner ----------
  const scanDlg = $('#scan');
  let scanner = null, scanBusy = false;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
  }
  async function getScannerLib() {
    if (!window.Html5Qrcode) await loadScript('vendor/html5-qrcode.min.js');
    return window.Html5Qrcode;
  }
  const scanConfig = () => ({
    formatsToSupport: window.Html5QrcodeSupportedFormats ? [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E] : undefined,
    verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true }
  });
  async function startCam() {
    try {
      const Lib = await getScannerLib();
      scanner = new Lib('reader', scanConfig());
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w * .85, 320)), height: Math.floor(Math.min(h * .5, 150)) }) },
        code => onCode(code), () => { });
    } catch {
      $('#reader').innerHTML = `<div class="reader-msg">📷 ${esc(t('camFail'))}</div>`;
    }
  }
  async function stopScanner() {
    if (scanner) { const s = scanner; scanner = null; try { if (s.isScanning) await s.stop(); s.clear(); } catch { } }
  }
  $('#scan-btn').addEventListener('click', () => {
    if (state.guest) { toast(t('guestNoEdit')); return; }
    $('#scan-result').innerHTML = ''; $('#scan-code').value = ''; scanBusy = false;
    scanDlg.showModal(); startCam();
  });
  $('#scan-close').addEventListener('click', () => scanDlg.close());
  scanDlg.addEventListener('close', () => { stopScanner(); $('#reader').innerHTML = ''; });
  $('#scan-file').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const Lib = await getScannerLib();
      await stopScanner();
      const tmp = new Lib('reader', scanConfig());
      const code = await tmp.scanFile(f, false);
      tmp.clear(); onCode(code);
    } catch { $('#scan-result').innerHTML = `<div class="scan-card warn">${esc(t('noCodeInPhoto'))}</div>`; }
  });
  $('#scan-code-go').addEventListener('click', () => { const c = $('#scan-code').value.replace(/\D/g, ''); if (c.length >= 8) onCode(c); else toast(t('codeTooShort')); });
  $('#scan-code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#scan-code-go').click(); } });

  const CAT_MAP = [
    [/london-dry|^gins?$|-gins?$/, 'Gin'], [/vodkas?$/, 'Vodka'], [/white-rums?|light-rums?|rhums-blancs?/, 'Light rum'], [/dark-rums?|rhums-ambres?|aged-rums?/, 'Dark rum'],
    [/spiced-rums?/, 'Spiced rum'], [/^rums?$|^rhums?$|-rums?$/, 'Rum'], [/tequilas?$/, 'Tequila'], [/mezcals?$/, 'Mezcal'],
    [/bourbons?/, 'Bourbon'], [/scotch/, 'Scotch'], [/irish-whiske?ys?/, 'Irish whiskey'], [/whiske?ys?$|whiskies$/, 'Whiskey'],
    [/cognacs?$/, 'Cognac'], [/brand(y|ies)$/, 'Brandy'], [/amarettos?$/, 'Amaretto'], [/coffee-liqueurs?/, 'Coffee liqueur'], [/cream-liqueurs?/, 'Baileys irish cream'],
    [/triple-sec|orange-liqueurs?/, 'Triple sec'], [/vermouths?$/, 'Dry vermouth'], [/proseccos?$/, 'Prosecco'], [/champagnes?$/, 'Champagne'],
    [/sparkling-wines?$/, 'Champagne'], [/red-wines?$/, 'Red wine'], [/white-wines?$/, 'White wine'], [/^beers?$|lagers?$|-beers?$/, 'Beer'], [/ciders?$/, 'Cider'],
    [/tonic/, 'Tonic water'], [/ginger-beers?/, 'Ginger beer'], [/ginger-ales?/, 'Ginger ale'], [/^colas?$|-colas?$/, 'Coca-Cola'],
    [/lemonades?$/, 'Lemonade'], [/sparkling-waters?|carbonated-waters?|soda-waters?/, 'Soda water'], [/grenadine/, 'Grenadine'],
    [/orange-juices?/, 'Orange juice'], [/pineapple-juices?/, 'Pineapple juice'], [/cranberry-juices?/, 'Cranberry juice'], [/apple-juices?/, 'Apple juice'],
    [/grapefruit-juices?/, 'Grapefruit juice'], [/tomato-juices?/, 'Tomato juice'], [/lemon-juices?/, 'Lemon juice'], [/lime-juices?/, 'Lime juice'],
    [/syrups?$/, 'Sugar syrup']
  ];
  const BRAND_MAP = [
    [/aperol/, 'Aperol'], [/campari/, 'Campari'], [/baileys/, 'Baileys irish cream'], [/kahl[uú]a/, 'Kahlua'], [/malibu/, 'Malibu rum'],
    [/j[aä]germeister/, 'Jagermeister'], [/cointreau/, 'Cointreau'], [/grand marnier/, 'Grand Marnier'], [/disaronno|amaretto/, 'Amaretto'],
    [/smirnoff|absolut|grey goose|belvedere|eristoff|stolichnaya|wodka|vodka/, 'Vodka'],
    [/bombay|tanqueray|gordon'?s|hendrick|beefeater|monkey 47|\bgin\b/, 'Gin'], [/captain morgan|kraken|sailor jerry/, 'Spiced rum'],
    [/bacardi|havana club/, 'Light rum'], [/jack daniel|jim beam|maker'?s mark|bourbon/, 'Bourbon'], [/jameson|tullamore/, 'Irish whiskey'],
    [/johnnie walker|chivas|glenfiddich|ballantine|scotch/, 'Scotch'], [/jose cuervo|sierra|olmeca|patr[oó]n|tequila/, 'Tequila'],
    [/martini rosso|cinzano rosso|vermouth rosso/, 'Sweet vermouth'], [/martini (extra )?dry|noilly/, 'Dry vermouth'], [/lillet/, 'Lillet Blanc'],
    [/tonic/, 'Tonic water'], [/ginger beer/, 'Ginger beer'], [/ginger ale/, 'Ginger ale'],
    [/coca-?cola|\bcoke\b|pepsi/, 'Coca-Cola'], [/sprite|7 ?up/, 'Sprite'], [/red bull/, 'Red Bull'], [/grenadine/, 'Grenadine'], [/monin|sirup|syrup/, 'Sugar syrup'],
    [/prosecco/, 'Prosecco'], [/champagne|moët|veuve/, 'Champagne'], [/blue cura[cç]ao/, 'Blue Curacao'], [/pernod|ricard|pastis/, 'Pernod'],
    [/southern comfort/, 'Southern Comfort'], [/limoncello/, 'Limoncello'], [/st[- ]germain/, 'St. Germain']
  ];
  function guessIngredients(p) {
    const name = [p.product_name, p.product_name_de, p.product_name_en, p.generic_name, p.brands].filter(Boolean).join(' ').toLowerCase();
    const out = [];
    const push = n => { if (n && !out.some(x => key(x) === key(n))) out.push(n); };
    BRAND_MAP.forEach(([re, n]) => { if (re.test(name)) push(n); });
    const catList = (p.categories_tags || []).map(c => c.replace(/^[a-z]{2}:/, '')).reverse(); // spezifischste zuerst
    for (const c of catList) for (const [re, n] of CAT_MAP) if (re.test(c)) { push(n); break; }
    for (const [k, e] of state.ingIndex) {
      if (k.length < 4 || !e.db) continue;
      if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(name)) push(e.name);
    }
    return out.slice(0, 5);
  }
  async function onCode(code) {
    if (scanBusy) return; scanBusy = true;
    if (navigator.vibrate) navigator.vibrate(60);
    await stopScanner();
    $('#reader').innerHTML = '';
    const box = $('#scan-result');
    box.innerHTML = `<div class="scan-card">🔎 ${esc(t('lookingUp', { c: code }))}</div>`;
    const again = `<button class="btn-text" id="scan-again">${esc(t('scanAgain'))}</button>`;
    try {
      const r = await fetch(`${OFF}${encodeURIComponent(code)}.json?fields=product_name,product_name_de,product_name_en,generic_name,brands,categories_tags,image_small_url`);
      const j = await r.json();
      if (!j || j.status !== 1 || !j.product) throw new Error('nf');
      const p = j.product;
      const title = [String(p.brands || '').split(',')[0], p.product_name || p.product_name_de || p.product_name_en].filter(Boolean).join(' – ') || code;
      const guesses = guessIngredients(p);
      box.innerHTML = `<div class="scan-card">
        <div class="scan-prod">${/^https:\/\//.test(p.image_small_url || '') ? `<img src="${esc(p.image_small_url)}" alt="">` : '<span class="noimg">🍾</span>'}<div><small>${esc(t('found'))}</small><strong>${esc(title)}</strong></div></div>
        ${guesses.length ? `<p>${esc(t('addAs'))}</p><div class="chips">${guesses.map((g, i) => `<button class="chip add${i === 0 ? ' best' : ''}" data-scanadd="${esc(g)}">${ingImg(state.ingIndex.get(key(g)) || { name: g, db: true })}<span>${esc(ingName(g))}</span><span class="plus">+</span></button>`).join('')}</div>`
          : `<p>${esc(t('noMatch'))}</p>`}
        <div class="scan-more"><button class="btn-text" data-scantype>${esc(t('typeOther'))}</button>${again}</div></div>`;
    } catch {
      box.innerHTML = `<div class="scan-card warn">${esc(t('notFound', { c: code }))}
        <div class="scan-more"><button class="btn-text" data-scantype>${esc(t('typeIt'))}</button>${again}</div></div>`;
    }
    scanBusy = false;
  }
  scanDlg.addEventListener('click', e => {
    if (e.target === scanDlg) return scanDlg.close();
    const a = e.target.closest('[data-scanadd]');
    if (a) { addIng(a.dataset.scanadd); a.classList.add('done'); a.disabled = true; return; }
    if (e.target.closest('[data-scantype]')) { scanDlg.close(); if (currentView() !== 'bar') location.hash = '#bar'; setTimeout(() => input.focus(), 50); return; }
    if (e.target.closest('#scan-again')) { $('#scan-result').innerHTML = ''; startCam(); }
  });

  // ---------- Globale Klicks ----------
  document.addEventListener('click', e => {
    if (e.target.closest('#scan')) return;
    const add = e.target.closest('[data-add]');
    if (add) {
      e.stopPropagation();
      if (state.guest) { toast(t('guestNoEdit')); return; }
      addIng(add.dataset.add);
      if (dlg.open) openDetail(dlg.dataset.id, true);
      return;
    }
    const low = e.target.closest('[data-low]'); if (low) { toggleLow(low.dataset.low); return; }
    const pers = e.target.closest('[data-pers]');
    if (pers) { state.persons = Math.max(1, Math.min(50, state.persons + +pers.dataset.pers)); openDetail(dlg.dataset.id, true); return; }
    const rate = e.target.closest('[data-rate]');
    if (rate) {
      const id = dlg.dataset.id, n = +rate.dataset.rate, cur = state.notes[id] || {};
      state.notes[id] = { ...cur, r: cur.r === n ? 0 : n }; saveNotes();
      $$('.stars button', dlg).forEach(b => b.classList.toggle('on', +b.dataset.rate <= state.notes[id].r));
      if (!reduceMotion) rate.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300 });
      return;
    }
    const made = e.target.closest('[data-made]');
    if (made) {
      const d = findDrink(made.dataset.made);
      state.hist.push({ id: d.id, t: Date.now() }); if (state.hist.length > 500) state.hist.shift(); saveHist();
      const n = state.hist.filter(h => h.id === d.id).length;
      $('.made-info', dlg).textContent = t('madeInfo', { n, d: fmtDate(Date.now()) });
      if (!reduceMotion) made.animate([{ transform: 'rotate(-6deg) scale(1.05)' }, { transform: 'rotate(6deg)' }, { transform: 'none' }], { duration: 400 });
      toast(t('cheers')); return;
    }
    const ts = e.target.closest('[data-toshop]');
    if (ts) {
      const d = findDrink(ts.dataset.toshop);
      const n = addToShop(d.name, status(d).missing);
      toast(n ? t('toShopDone', { n }) : t('toShopAlready'));
      ts.textContent = '✓ ' + t('onShopList'); ts.disabled = true; return;
    }
    const sa = e.target.closest('[data-shopadd]');
    if (sa) { const n = addToShop('', [sa.dataset.shopadd]); toast(n ? t('toShopDone', { n }) : t('toShopAlready')); return; }
    const sd = e.target.closest('[data-shopdel]');
    if (sd) { state.shop = state.shop.filter(x => x.k !== sd.dataset.shopdel); saveShop(); updateBadges(); renderShop(); return; }
    if (e.target.closest('#shop-tobar')) {
      if (state.guest) { toast(t('guestNoEdit')); return; }
      const done = state.shop.filter(x => x.done);
      done.forEach(x => { state.bar.add(x.k); state.low.delete(x.k); }); saveBar(); saveLow();
      state.shop = state.shop.filter(x => !x.done); saveShop(); renderShop(); updateBadges();
      toast(t('toBarDone', { n: done.length })); return;
    }
    if (e.target.closest('#shop-clear')) { if (!confirm(t('confirmClearList'))) return; state.shop = []; saveShop(); updateBadges(); renderShop(); return; }
    if (e.target.closest('#shop-share')) {
      shareOrCopy(t('shopListTitle') + '\n' + state.shop.filter(x => !x.done).map(x => '• ' + ingName(x.name)).join('\n'));
      return;
    }
    if (e.target.closest('#bar-share')) { openShareBar(); return; }
    const sh = e.target.closest('[data-sharedrink]'); if (sh) { shareDrink(sh.dataset.sharedrink); return; }
    const rm = e.target.closest('[data-remove]'); if (rm) { if (state.guest) { toast(t('guestNoEdit')); return; } removeIng(rm.dataset.remove); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const id = fav.dataset.fav;
      state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id); saveFavs();
      toast(state.favs.has(id) ? t('favOn') : t('favOff'));
      if (dlg.open) fav.textContent = state.favs.has(id) ? '♥ ' + t('isFav') : '♡ ' + t('makeFav');
      else {
        $$(`.fav[data-fav="${CSS.escape(id)}"]`).forEach(b => {
          b.classList.toggle('on', state.favs.has(id));
          if (!reduceMotion && state.favs.has(id)) b.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300 });
        });
        if (state.tags.has('fav')) renderCurrent();
      }
      return;
    }
    const edit = e.target.closest('[data-edit]'); if (edit) { dlg.close(); startEdit(edit.dataset.edit); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm(t('confirmDel'))) return;
      state.own = state.own.filter(o => o.id !== del.dataset.del); saveOwn(); rebuildIngIndex(); dlg.close(); toast(t('deleted')); renderCurrent(); return;
    }
    if (e.target.closest('#retry')) { init(true); return; }
    const tb = e.target.closest('.tagfilter button');
    if (tb) {
      const tg = tb.dataset.t; state.tags.has(tg) ? state.tags.delete(tg) : state.tags.add(tg);
      $$(`.tagfilter button[data-t="${tg}"]`).forEach(x => x.classList.toggle('on', state.tags.has(tg)));
      currentView() === 'all' ? renderAll() : renderMix();
      return;
    }
    const op = e.target.closest('[data-open]'); if (op) { openDetail(op.dataset.open); return; }
    const card = e.target.closest('.card'); if (card) openDetail(card.dataset.id);
  });
  document.addEventListener('change', e => {
    const cb = e.target.closest('[data-shop]'); if (!cb) return;
    const it = state.shop.find(x => x.k === cb.dataset.shop); if (it) { it.done = cb.checked; saveShop(); updateBadges(); renderShop(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList?.contains('card')) openDetail(e.target.dataset.id); });

  // Filter
  $('#all-filter').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.filter = b.dataset.f; $$('#all-filter button').forEach(x => x.classList.toggle('on', x === b)); renderAll();
  });
  let qTimer;
  $('#all-search').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.query = e.target.value; renderAll(); }, 150); });
  $('#all-more').addEventListener('click', () => { state.shown += PAGE; renderAll(true); });

  // ---------- Eigene Rezepte ----------
  const form = $('#recipe-form'), ingBox = $('#f-ings');
  let formImg = '';
  function ingRow(n = '', m = '') {
    const r = document.createElement('div'); r.className = 'ing-row';
    r.innerHTML = `<input list="ing-datalist" placeholder="${esc(t('ingredient'))}" value="${esc(n)}" maxlength="60" aria-label="${esc(t('ingredient'))}">
      <input placeholder="${esc(t('amountPh'))}" value="${esc(m)}" maxlength="30" aria-label="${esc(t('amount'))}">
      <button type="button" aria-label="${esc(t('remove'))}">${icon.x}</button>`;
    $('button', r).onclick = () => { if ($$('.ing-row', ingBox).length > 1) r.remove(); else $$('input', r).forEach(i => i.value = ''); };
    ingBox.append(r);
  }
  function resetForm() {
    form.reset(); ingBox.innerHTML = ''; ingRow(); ingRow(); ingRow();
    formImg = ''; setPreview(''); $$('#f-tags button').forEach(b => b.classList.remove('on'));
    state.editId = null; $('#form-title').textContent = t('newTitle'); $('#f-cancel').hidden = true; $('#f-error').hidden = true;
  }
  function setPreview(src) {
    const p = $('#f-img-preview'); p.hidden = !src; if (src) p.src = src; else p.removeAttribute('src');
    $('#img-drop-text').hidden = !!src;
  }
  function startEdit(id) {
    const o = state.own.find(x => x.id === id); if (!o) return;
    location.hash = '#new';
    resetForm(); state.editId = id;
    $('#form-title').textContent = t('editTitle'); $('#f-cancel').hidden = false;
    $('#f-name').value = o.name; $('#f-alc').value = o.alc; $('#f-glass').value = o.glass || ''; $('#f-instr').value = o.instr || '';
    if (o.img && o.img.startsWith('data:')) { formImg = o.img; setPreview(o.img); } else if (o.img) { $('#f-img-url').value = o.img; setPreview(o.img); }
    ingBox.innerHTML = ''; o.ings.forEach(i => ingRow(ingName(i.name), i.measure)); ingRow();
    (o.tags || []).forEach(tg => $(`#f-tags button[data-t="${tg}"]`)?.classList.add('on'));
  }
  $('#f-tags').addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); });
  $('#f-add-ing').onclick = () => { ingRow(); $$('.ing-row input', ingBox).slice(-2)[0].focus(); };
  $('#f-cancel').onclick = () => { resetForm(); location.hash = '#all'; };
  $('#f-img-file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      formImg = c.toDataURL('image/jpeg', .8); setPreview(formImg); $('#f-img-url').value = ''; URL.revokeObjectURL(url);
    };
    img.onerror = () => toast(t('badImage'));
    img.src = url;
  });
  $('#f-img-url').addEventListener('change', e => { const v = e.target.value.trim(); if (/^https?:\/\//.test(v)) { formImg = ''; setPreview(v); } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (state.guest) { toast(t('guestNoEdit')); return; }
    const name = $('#f-name').value.trim();
    const ings = $$('.ing-row', ingBox).map(r => { const [a, b] = $$('input', r); return { name: a.value.trim(), measure: b.value.trim() }; }).filter(i => i.name);
    const err = !name ? t('errName') : !ings.length ? t('errIngs') : '';
    $('#f-error').textContent = err; $('#f-error').hidden = !err; if (err) return;
    ings.forEach(i => {
      const k = key(i.name);
      const hit = state.ingIndex.get(k) || [...state.ingIndex.entries()].find(([kk]) => key(DE[kk] || '') === k)?.[1];
      if (hit) i.name = hit.name;
    });
    const urlV = $('#f-img-url').value.trim();
    const rec = {
      id: state.editId || 'own-' + Date.now().toString(36), name, ings,
      img: formImg || (/^https?:\/\//.test(urlV) ? urlV : ''),
      alc: $('#f-alc').value, glass: $('#f-glass').value.trim(), instr: $('#f-instr').value.trim(), instrDE: '',
      tags: $$('#f-tags button.on').map(b => b.dataset.t)
    };
    const wasEdit = !!state.editId;
    if (wasEdit) state.own = state.own.map(o => o.id === state.editId ? rec : o); else state.own.unshift(rec);
    saveOwn(); rebuildIngIndex();
    toast(wasEdit ? t('updated') : t('saved'));
    resetForm();
    state.filter = 'own'; $$('#all-filter button').forEach(x => x.classList.toggle('on', x.dataset.f === 'own'));
    location.hash = '#all';
    setTimeout(() => openDetail(rec.id), 80);
  });

  // ---------- Toast ----------
  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- Theme, Sprache, Alkoholfrei ----------
  function updateThemeColor() {
    const m = $('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(document.body).backgroundColor;
  }
  $('#theme-btn').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem(K.theme, root.dataset.theme); } catch { }
    updateThemeColor();
  });
  $('#lang-btn').addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de'; save(K.lang, lang);
    applyStatic(); rebuildIngIndex(); renderGuestBanner();
    if (!state.editId) $('#form-title').textContent = t('newTitle'); else $('#form-title').textContent = t('editTitle');
    if (dlg.open) openDetail(dlg.dataset.id, true);
    renderCurrent();
  });
  function applyAF() {
    const b = $('#af-btn'); b.setAttribute('aria-pressed', String(state.af)); b.classList.toggle('on', state.af);
    document.body.classList.toggle('af-on', state.af);
    if (state.af) state.tags.delete('strong');
    renderTagBars();
  }
  $('#af-btn').addEventListener('click', () => {
    state.af = !state.af; save(K.af, state.af); applyAF();
    toast(state.af ? t('afOn') : t('afOff'));
    if (dlg.open) openDetail(dlg.dataset.id, true);
    renderCurrent();
  });

  // ---------- Routing ----------
  const VIEWS = ['mix', 'bar', 'all', 'shop', 'new'];
  const currentView = () => { const v = location.hash.slice(1); return VIEWS.includes(v) ? v : 'mix'; };
  function route() {
    if (/^#[sdr]=/.test(location.hash)) {
      handleIncoming(); rebuildIngIndex();
      if (pendingDrink && !state.loading) { const id = pendingDrink; pendingDrink = null; setTimeout(() => findDrink(id) ? openDetail(id) : toast(t('drinkNotFound')), 50); }
    }
    const v = currentView();
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
    if (v === 'mix') renderMix();
    if (v === 'bar') renderBar();
    if (v === 'all') renderAll();
    if (v === 'shop') renderShop();
    updateBadges();
    window.scrollTo({ top: 0 });
  }
  addEventListener('hashchange', route);

  // ---------- Start ----------
  async function init(force) {
    state.loading = true; state.loadErr = null;
    if (force) route();
    try { state.drinks = (await loadDB()).map(prepare); } catch (err) { state.loadErr = err; }
    state.loading = false;
    rebuildIngIndex();
    route();
    if (pendingDrink) { const id = pendingDrink; pendingDrink = null; if (findDrink(id)) openDetail(id); else toast(t('drinkNotFound')); }
    if (state.loadErr) toast(t('dbOffline'));
  }
  applyStatic();
  applyAF();
  resetForm();
  handleIncoming();
  rebuildIngIndex();
  route();
  updateThemeColor();
  init();

  // Für Tests
  window.__hb = { state, status, scaleMeasure, guessIngredients, afVersion, season, computeTools };
})();
