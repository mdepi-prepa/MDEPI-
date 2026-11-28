// Nettoyage d'un HTML venu d'ailleurs (fiches LiSA importées) avant de
// l'afficher : on ne garde que des balises de mise en forme simples, des
// liens http(s) et des images https. Tout le reste (scripts, styles,
// formulaires, attributs on…, liens javascript:) disparaît.
// Utilise le DOMParser du navigateur (jsdom dans les tests).

const BALISES = new Set([
  'p', 'br', 'hr', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'big', 'ins', 'mark',
  'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'div', 'span', 'a', 'img', 'blockquote', 'pre', 'code', 'dl', 'dt', 'dd', 'figure', 'figcaption',
]);
// Balises retirées avec tout leur contenu.
const A_JETER = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'noscript', 'template', 'svg', 'math', 'frame', 'frameset', 'audio', 'video', 'source', 'track', 'canvas']);
// Seules classes gardées : les rangs A/B des objectifs (filtre « Rang A / Rang B »).
const CLASSES = new Set(['rang-A', 'rang-B']);
const PROPRIETES_STYLE = new Set(['text-align', 'vertical-align', 'background-color', 'background', 'color', 'font-weight', 'font-style', 'text-decoration']);

const urlHttp = (u, https = false) => {
  try {
    const x = new URL(u, 'https://livret.uness.fr/');
    return (x.protocol === 'https:' || (!https && x.protocol === 'http:')) ? x.href : null;
  } catch {
    return null;
  }
};

function styleSur(style) {
  const garde = [];
  for (const decl of String(style).split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    if (!PROPRIETES_STYLE.has(prop)) continue;
    // Couleurs et mots simples seulement (pas d'url(), d'expression…).
    if (!/^[#\w\s(),.%-]{1,60}$/.test(val) || /url|expression|var\(/i.test(val)) continue;
    garde.push(`${prop}: ${val}`);
  }
  return garde.join('; ');
}

function nettoyerNoeud(noeud, doc) {
  for (const enfant of [...noeud.childNodes]) {
    if (enfant.nodeType === 8) {
      enfant.remove(); // commentaire
      continue;
    }
    if (enfant.nodeType !== 1) continue;
    let el = enfant;
    let nom = el.tagName.toLowerCase();
    if (A_JETER.has(nom)) {
      el.remove();
      continue;
    }
    if (nom === 'h1') {
      // Titres de niveau 1 dans le contenu : ramenés au niveau 3.
      const h3 = doc.createElement('h3');
      h3.append(...el.childNodes);
      el.replaceWith(h3);
      el = h3;
      nom = 'h3';
    }
    nettoyerNoeud(el, doc);
    if (!BALISES.has(nom)) {
      el.replaceWith(...el.childNodes); // balise inconnue : on garde son texte
      continue;
    }
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      const v = attr.value;
      let garder = false;
      if (n === 'class') {
        const c = v.split(/\s+/).filter((x) => CLASSES.has(x));
        if (c.length) el.setAttribute('class', c.join(' '));
        garder = c.length > 0;
      } else if (n === 'style') {
        const s = styleSur(v);
        if (s) el.setAttribute('style', s);
        garder = !!s;
      } else if ((n === 'colspan' || n === 'rowspan') && (nom === 'td' || nom === 'th')) {
        garder = /^\d{1,3}$/.test(v);
      } else if (nom === 'a' && n === 'href') {
        const u = urlHttp(v);
        if (u) el.setAttribute('href', u);
        garder = !!u;
      } else if (nom === 'a' && n === 'title') {
        garder = true;
      } else if (nom === 'img' && n === 'src') {
        const u = urlHttp(v, true);
        if (u) el.setAttribute('src', u);
        garder = !!u;
      } else if (nom === 'img' && (n === 'alt' || n === 'width' || n === 'height')) {
        garder = n === 'alt' || /^\d{1,4}$/.test(v);
      }
      if (!garder) el.removeAttribute(attr.name);
    }
    if (nom === 'a') {
      if (el.hasAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (nom === 'img') {
      if (!el.hasAttribute('src')) el.remove();
      else {
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
    }
  }
}

export function nettoyerHtml(source) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${source || ''}`, 'text/html');
  nettoyerNoeud(doc.body, doc);
  return doc.body.innerHTML;
}
