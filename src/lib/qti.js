// Lecture des exports QTI de Théia (et QTI 1.2, 2.x, 3.0 en général).
// Repris du banc d'essai testé sur un vrai export Théia
// (https://claude.ai/artifact/M4WEPSy2kzKgtK6spkjvnU). Particularités Théia :
// responseIdentifier différent de la déclaration, HTML échappé façon Word,
// lettre « A. » dans le texte, questions toujours typées QRM, matière et
// promo lues dans le titre du dossier, correction dans modalFeedback.
//
// parsePackage(files) : files = { chemin: texte | Blob }
// → { questions, versions, msgs: [{k: 'i'|'w'|'e', m}], images: { chemin: Blob } }
// Les images sont remplacées dans le HTML par « qcm-img:<chemin> ».

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const all=(el,n)=>Array.from(el.getElementsByTagNameNS('*',n));
const one=(el,n)=>el.getElementsByTagNameNS('*',n)[0]||null;
const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
function joinPath(base,href){
 if(/^(https?:|data:)/.test(href))return href;
 const parts=(base.includes('/')?base.slice(0,base.lastIndexOf('/')+1):'')+href;
 const out=[];for(const p of parts.split('/')){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p)}return out.join('/');
}
const SAFE=new Set(['p','br','b','strong','i','em','u','sub','sup','ul','ol','li','table','thead','tbody','tr','td','th','span','div','img','h4','h5']);
/* Convertit un fragment XML/HTML en HTML sûr : seules les balises de mise en forme passent, pas d'attributs sauf src/alt d'image. */
function clean(node,ctx){
 let out='';
 for(const c of node.childNodes){
  if(c.nodeType===3){const v=c.nodeValue;if(/<\/?[a-z][^>]*>/i.test(v)){ctx.escaped=true;out+=clean(new DOMParser().parseFromString(v,'text/html').body,ctx)}else out+=esc(v);continue}
  if(c.nodeType!==1)continue;
  const n=c.localName.toLowerCase();
  const st=(c.getAttribute&&c.getAttribute('style'))||'';
  const kl=n==='span'&&c.getAttribute('class');if(!st&&/^c-(ok|ko|note)$/.test(kl||'')){out+=`<span class="${kl}">${clean(c,ctx)}</span>`;continue}
  if(st&&(n==='span'||n==='p'||n==='div')){const cls=tone(st),bold=/font-weight:\s*(bold|[6-9]00)/i.test(st);let inner=clean(c,ctx);if(bold)inner=`<strong>${inner}</strong>`;if(cls)inner=`<span class="${cls}">${inner}</span>`;out+=n==='span'?inner:`<${n}>${inner}</${n}>`;continue}
  if(n==='img'||n==='object'||n==='qti-object'||n==='matimage'){out+=imgTag(c.getAttribute('src')||c.getAttribute('data')||c.getAttribute('uri'),c.getAttribute('alt'),ctx);continue}
  if(n==='mattext'&&/html/i.test(c.getAttribute('texttype')||'')){out+=clean(new DOMParser().parseFromString(c.textContent,'text/html').body,ctx);continue}
  if(SAFE.has(n))out+=n==='br'?'<br>':`<${n}>${clean(c,ctx)}</${n}>`;
  else out+=clean(c,ctx);
 }
 return out;
}
/* Couleurs Théia : vert = juste, rouge = faux, autre couleur = remarque */
function tone(st){const m=st.match(/(?:^|;)\s*color:\s*#([0-9a-f]{6})/i);if(!m)return '';const v=m[1].toLowerCase(),r=parseInt(v.slice(0,2),16),g=parseInt(v.slice(2,4),16),b=parseInt(v.slice(4),16);if(r+g+b<120)return '';if(g>r+40&&g>b)return 'c-ok';if(r>g+80&&r>b+40)return 'c-ko';return 'c-note'}
const LETTER=/^((?:\s|<[^>]+>)*)(?:[•·▪●◦-]((?:\s|<[^>]+>)*))?[A-J][.)]\s*/;
const sid=id=>(String(id).match(/_(\d+)$/)||[0,id])[1];
const stripLetter=s=>s.replace(LETTER,'$1$2');
/* Découpe une correction rédigée proposition par proposition (« • A. … ») */
function splitFeedback(html,n){
 const box=document.createElement('div');box.innerHTML=html;
 const leaves=[...box.querySelectorAll('p,div,li')].filter(e=>!e.querySelector('p,div,li'));
 const per={},rest=[];
 for(const e of leaves){const m=e.textContent.match(/^[\s•·▪●◦-]*([A-J])[.)]\s/);if(m&&m[1].charCodeAt(0)-65<n)per[m[1]]=stripLetter(e.innerHTML);else if(e.textContent.trim())rest.push(e.outerHTML)}
 return Object.keys(per).length>=2?{per,general:rest.join('')}:{per:{},general:html};
}
function imgTag(src,alt,ctx){
 if(!src)return '';
 const path=joinPath(ctx.base,src);
 ctx.images.push(path);
 const url=ctx.media(path,src);
 if(!url){ctx.warn(`Image introuvable : ${src}`);return `<span class="ph-missing">Image manquante : ${esc(src)}</span>`}
 return `<img src="${esc(url)}" alt="${esc(alt||'')}">`;
}
function parseItem12(item,ctx){
 const q={id:item.getAttribute('ident')||'',titre:item.getAttribute('title')||'',version:'1.2',propositions:[],reponses:[],correction:'',meta:{}};
 for(const f of all(item,'qtimetadatafield'))q.meta[txt(one(f,'fieldlabel'))]=txt(one(f,'fieldentry'));
 const pres=one(item,'presentation');
 const lid=pres&&one(pres,'response_lid'),str=pres&&one(pres,'response_str');
 if(pres){const stem=pres.cloneNode(true);for(const r of [...all(stem,'response_lid'),...all(stem,'response_str'),...all(stem,'response_num'),...all(stem,'response_xy')])r.remove();q.enonce=clean(stem,ctx)}
 const good=new Set();
 for(const rc of all(item,'respcondition')){
  const sv=one(rc,'setvar');if(sv&&!(parseFloat(sv.textContent)>0))continue;
  for(const v of all(rc,'varequal')){let p=v.parentElement,neg=false;while(p&&p!==rc){if(p.localName==='not')neg=true;p=p.parentElement}if(!neg)good.add(txt(v))}
 }
 if(lid){
  q.type=/multiple/i.test(lid.getAttribute('rcardinality')||'')?'QRM':'QRU';
  q.propositions=all(lid,'response_label').map(l=>({id:l.getAttribute('ident'),texte:clean(l,ctx),correcte:good.has(l.getAttribute('ident'))}));
 }else if(str){q.type='QROC';q.reponses=[...good]}
 else if(pres&&one(pres,'response_xy')){q.type='QZONE'}
 else q.type='inconnu';
 q.correction=all(item,'itemfeedback').map(f=>clean(f,ctx)).join(' ');
 return q;
}
function parseItem2(root,ctx,ver){
 const v3=ver==='3.0',P=v3?'qti-':'',A=n=>v3?n.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()):n;
 const q={id:root.getAttribute('identifier')||'',titre:root.getAttribute('title')||'',version:ver,propositions:[],reponses:[],correction:'',meta:{}};
 const decl={};
 for(const d of all(root,v3?'qti-response-declaration':'responseDeclaration'))decl[d.getAttribute('identifier')]={card:d.getAttribute('cardinality'),vals:all(d,v3?'qti-value':'value').filter(v=>v.parentElement.localName===P+'correctResponse'||v.parentElement.localName==='qti-correct-response').map(txt),keys:all(d,v3?'qti-map-entry':'mapEntry').map(e=>e.getAttribute(A('mapKey')))};
 const body=one(root,v3?'qti-item-body':'itemBody');
 if(!body){q.type='inconnu';ctx.warn(`${q.id} : pas de corps de question`);return q}
 const I=n=>P+(v3?A(n):n);
 const choice=one(body,I('choiceInteraction')),text=one(body,I('textEntryInteraction'))||one(body,I('extendedTextInteraction'));
 const unsupported=['hotspotInteraction','selectPointInteraction','graphicOrderInteraction','graphicAssociateInteraction','matchInteraction','associateInteraction','gapMatchInteraction','orderInteraction','inlineChoiceInteraction','sliderInteraction'].find(n=>one(body,I(n)));
 const stem=body.cloneNode(true);
 for(const n of ['choiceInteraction','textEntryInteraction','extendedTextInteraction'])for(const e of all(stem,I(n))){if(n==='choiceInteraction'){const pr=one(e,I('prompt'));if(pr)e.parentNode.insertBefore(pr,e)}e.remove()}
 if(choice){
  const rid=choice.getAttribute(A('responseIdentifier'));let d=decl[rid];
  if(!d){const ks=Object.keys(decl);if(ks.length===1){d=decl[ks[0]];ctx.note('rid',`L'identifiant de réponse de l'interaction ne correspond pas à la déclaration (${ks[0]}) : rattaché automatiquement`)}else d={vals:[]}}
  const max=parseInt(choice.getAttribute(A('maxChoices'))??'1',10);
  q.type=(d.card==='single'||max===1)?'QRU':'QRM';
  if(q.type==='QRM'&&max>1)q.maxChoix=max;
  q.propositions=all(choice,I('simpleChoice')).map(c=>({id:c.getAttribute('identifier'),texte:stripLetter(clean(c,ctx).replace(/<\/?(div|p)>/g,' ').replace(/^\s+/,'')),correcte:d.vals.includes(c.getAttribute('identifier'))}));
  if(!d.vals.length)ctx.warn(`${q.id} : aucune bonne réponse déclarée`);
  if(q.type==='QRM'&&d.vals.length===1){q.qruProbable=true;ctx.note('qru',`Question${''} déclarée QRM avec une seule bonne réponse : ${sid(q.id)}`)}
 }else if(text){
  const d=decl[text.getAttribute(A('responseIdentifier'))]||Object.values(decl)[0]||{vals:[],keys:[]};
  q.type='QROC';q.reponses=[...new Set([...d.vals,...d.keys.filter(Boolean)])];
 }else if(unsupported){q.type=/hotspot|selectPoint|graphic/.test(unsupported)?'QZONE':/match|associate|gapMatch/.test(unsupported)?'Association':'autre';q.nonSupporte=unsupported}
 else q.type='inconnu';
 if(unsupported&&(choice||text))ctx.warn(`${q.id} : contient aussi ${unsupported}, ignoré`);
 if(!q.nonSupporte)q.enonce=clean(stem,ctx);
 q.correction=all(root,v3?'qti-modal-feedback':'modalFeedback').map(f=>clean(f,ctx)).join(' ');
 if(q.correction&&q.propositions.length){const sp=splitFeedback(q.correction,q.propositions.length);q.correction=sp.general;q.propositions.forEach((p,i)=>{let e=sp.per[String.fromCharCode(65+i)];if(e===undefined)return;
  /* la correction Théia recopie la proposition : on ne garde que ce qui s'y ajoute */
  const tx=s=>{const d=document.createElement('div');d.innerHTML=s;return d.textContent.replace(/\s+/g,' ').trim()};const pt=tx(p.texte),et=tx(e);
  if(et.startsWith(pt)){const rest=et.slice(pt.length).replace(/^[\s.…]+/,'');if(!rest)return;e=esc(rest)}
  p.explication=e})}
 if(!q.nonSupporte&&!q.correction&&!q.propositions.some(p=>p.explication))ctx.note('nofb',`Sans correction rédigée : ${sid(q.id)}`);
 if(root.getAttribute('toolName'))q.meta.outil=root.getAttribute('toolName');
 return q;
}
function detect(doc){
 const r=doc.documentElement,n=r.localName,ns=r.namespaceURI||'';
 if(n==='questestinterop')return '1.2';
 if(n.startsWith('qti-'))return '3.0';
 if(n==='assessmentItem'||n==='assessmentTest'||n==='testPart'||n==='assessmentSection')return /v2p2/.test(ns)?'2.2':/v2p0/.test(ns)?'2.0':'2.1';
 if(n==='manifest')return 'manifeste';
 return null;
}
/* files : {chemin: texte | Blob}. Renvoie {questions, versions, messages} */
export async function parsePackage(files){
 const msgs=[],questions=[],versions=new Set(),urls={},images={};
 const warn=m=>msgs.push({k:'w',m}),err=m=>msgs.push({k:'e',m}),info=m=>msgs.push({k:'i',m});
 const notes={};const note=(k,m)=>{const[head,tail]=m.split(' : ');(notes[k]=notes[k]||{head,items:new Set()});if(tail&&!/rattaché/.test(tail))notes[k].items.add(tail);else notes[k].head=m};
 const tests=[];let escaped=false;
 const media=(path,raw)=>{
  const key=files[path]!==undefined?path:Object.keys(files).find(k=>k.split('/').pop()===raw.split('/').pop()&&!/\.xml$/i.test(k));
  if(!key)return null;
  if(key!==path)warn(`Image ${raw} trouvée seulement par son nom de fichier`);
  if(!urls[key]){const v=files[key];images[key]=v instanceof Blob?v:new Blob([v],{type:/\.svg$/i.test(key)?'image/svg+xml':'application/octet-stream'});urls[key]='qcm-img:'+key}
  return urls[key];
 };
 const read=async p=>{const v=files[p];return v instanceof Blob?await v.text():v};
 let entries=[];
 if(files['imsmanifest.xml']!==undefined){
  const man=new DOMParser().parseFromString(await read('imsmanifest.xml'),'application/xml');
  const res=all(man,'resource').filter(r=>/qti|xml/i.test(r.getAttribute('type')||'')||/\.xml$/i.test(r.getAttribute('href')||''));
  info(`Manifeste lu : ${res.length} ressource${res.length>1?'s':''} QTI`);
  for(const r of res){const h=r.getAttribute('href');if(files[h]===undefined)err(`Fichier listé dans le manifeste mais absent du ZIP : ${h}`);else entries.push(h)}
 }else entries=Object.keys(files).filter(k=>/\.(xml|qti)$/i.test(k));
 if(!entries.length)err('Aucun fichier XML trouvé');
 for(const path of entries){
  const doc=new DOMParser().parseFromString(await read(path),'application/xml');
  if(one(doc,'parsererror')){err(`${path} : XML illisible (${txt(one(doc,'parsererror')).slice(0,90)})`);continue}
  const ver=detect(doc);
  if(!ver||ver==='manifeste'){err(`${path} : format non reconnu (racine <${doc.documentElement.localName}>)`);continue}
  versions.add(ver);
  const ctx={base:path,images:[],media,warn,note};
  if(ver==='1.2')for(const it of all(doc,'item'))questions.push(parseItem12(it,ctx));
  else if(/^(qti-)?(assessment-?[tT]est|test-?[pP]art|assessment-?[sS]ection)$/.test(doc.documentElement.localName)){
   const refs=all(doc,ver==='3.0'?'qti-assessment-item-ref':'assessmentItemRef');
   const sec=one(doc,ver==='3.0'?'qti-assessment-section':'assessmentSection');
   tests.push({titre:sec?.getAttribute('title')||doc.documentElement.getAttribute('title')||'',lineaire:doc.documentElement.getAttribute(ver==='3.0'?'navigation-mode':'navigationMode')==='linear',refs:refs.map(r=>({id:r.getAttribute('identifier'),href:r.getAttribute('href')||'',poids:parseFloat(one(r,ver==='3.0'?'qti-weight':'weight')?.getAttribute('value'))||null}))});
   for(const r of refs){const h=joinPath(path,r.getAttribute('href'));if(!entries.includes(h)&&files[h]!==undefined)entries.push(h)}
  }else{questions.push(parseItem2(doc.documentElement,ctx,ver));if(ctx.escaped)escaped=true}
 }
 /* dossiers progressifs : ordre et énoncé commun pris dans le fichier pool / test */
 const ranges=[];
 for(const t of tests){
  const base=h=>h.split('/').pop().replace(/\.xml$/i,'');
  const found=t.refs.map(r=>questions.find(q=>q.id===r.id||q.id===base(r.href)));
  const miss=t.refs.filter((r,i)=>!found[i]);
  const m=t.titre.match(/\b(D[1-4])\b/);const mat=t.titre.replace(/\(.*?\)/g,'').replace(/\b(CONF|D[1-4]|DP\s*\d+|KFP\s*\d+)\b/gi,'').trim();
  info(`Dossier « ${t.titre} » : ${t.refs.length} questions${t.lineaire?' dans un ordre imposé':''}${m?`, promo ${m[1]} lue dans le titre`:''}`);
  if(miss.length)err(`Questions du dossier absentes des fichiers déposés : ${miss.map(r=>r.href||r.id).join(', ')}`);
  const got=found.filter(Boolean);
  got.forEach((q,i)=>{const r=t.refs[found.indexOf(q)];if(r?.poids)q.coefficient=r.poids;q.dossier={titre:t.titre,rang:i+1,total:got.length,promo:m?m[1]:null,matiere:mat||null};if(mat)q.meta.matiere=mat});
  ranges.push(...got);
  /* énoncé commun = début de la 1re question, avant « Q1 : » */
  if(got[0]&&got[0].enonce){const k=got[0].enonce.search(/Q1\s*:/);if(k>40){const box=document.createElement('div');box.innerHTML=got[0].enonce;const tx=box.textContent;const cut=tx.search(/Q1\s*:/);got.forEach(q=>q.dossier.contexte=tx.slice(0,cut).trim())}}
 }
 /* dossiers dans l'ordre des fichiers pool, puis questions isolées */
 if(ranges.length){const rest=questions.filter(q=>!ranges.includes(q));questions.splice(0,questions.length,...ranges,...rest)}
 if(escaped)info('Énoncés et propositions en HTML échappé avec styles Word (police, taille) : convertis, mise en forme d\'origine retirée, gras et couleurs gardés');
 if(questions.some(q=>q.propositions.some(p=>p.explication)))info(`Correction découpée proposition par proposition pour ${questions.filter(q=>q.propositions.some(p=>p.explication)).length} question(s)`);
 for(const k in notes){const n=notes[k];msgs.push({k:k==='nofb'?'w':'i',m:n.items.size?`${n.head} : ${[...n.items].join(', ')}`:n.head})}
 for(const q of questions)for(const p of q.propositions){const t=p.texte.replace(/<[^>]+>/g,'').trim();if(t&&!/[.!?»)%\d]$/.test(t)&&/\s\S{1,6}$/.test(t)&&t.length<40&&q.propositions.filter(o=>/[.!?]$/.test(o.texte.replace(/<[^>]+>/g,'').trim())).length>=3)warn(`${sid(q.id)} : proposition qui semble coupée, « ${t} »`)}
 for(const q of questions){
  if(q.type==='QZONE'||q.type==='Association')warn(`${q.id||'?'} : ${q.type}, non importée dans cette version`);
  else if(q.type==='inconnu'||q.type==='autre')warn(`${q.id||'?'} : type de question non reconnu`);
  else if((q.type==='QRU'||q.type==='QRM')&&!q.propositions.some(p=>p.correcte))warn(`${q.id} : aucune proposition marquée juste`);
  else if(q.type==='QRU'&&q.propositions.filter(p=>p.correcte).length>1)warn(`${q.id} : QRU avec plusieurs bonnes réponses`);
 }
 const ok=questions.filter(q=>['QRU','QRM','QRP','QROC'].includes(q.type)).length;
 if(questions.length)msgs.unshift({k:ok===questions.length?'i':'w',m:`${ok} question${ok>1?'s':''} importable${ok>1?'s':''} sur ${questions.length}`});
 return {questions,versions:[...versions],msgs,images};
}


// Fichiers choisis par l'enseignant (ZIP, ou un ou plusieurs XML) → { chemin: texte | Blob }
export async function lireFichiers(liste) {
  const fichiers = {};
  for (const f of liste) {
    if (/\.zip$/i.test(f.name) || (f.type || '').includes('zip')) {
      const { default: JSZip } = await import('jszip');
      const z = await JSZip.loadAsync(f);
      for (const [p, e] of Object.entries(z.files)) {
        if (e.dir || p.startsWith('__MACOSX')) continue;
        fichiers[p] = /\.(xml|qti)$/i.test(p)
          ? await e.async('string')
          : new Blob([await e.async('uint8array')], { type: /\.svg$/i.test(p) ? 'image/svg+xml' : /\.png$/i.test(p) ? 'image/png' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : /\.gif$/i.test(p) ? 'image/gif' : '' });
      }
    } else if (/\.(xml|qti)$/i.test(f.name)) fichiers[f.name] = await f.text();
    else fichiers[f.name] = f;
  }
  return fichiers;
}

// Regroupe les questions importables en dossiers progressifs, dans l'ordre.
// Les questions hors dossier vont dans « Questions isolées ».
export function versDossiers(questions) {
  const dossiers = [];
  const parTitre = new Map();
  for (const q of questions) {
    if (!['QRU', 'QRM', 'QROC'].includes(q.type)) continue;
    const titre = q.dossier?.titre || 'Questions isolées';
    let d = parTitre.get(titre);
    if (!d) {
      d = { titre, matiere: q.dossier?.matiere || q.meta?.matiere || '', contexte: q.dossier?.contexte || '', promo: q.dossier?.promo || null, questions: [] };
      parTitre.set(titre, d);
      dossiers.push(d);
    }
    // QRP : nombre de cases limité (maxChoices) sous le nombre de propositions.
    // Théia type tout en QRM : une seule bonne réponse → QRU (règle du cahier des charges).
    const nbBonnes = q.propositions.filter((p) => p.correcte).length;
    const qrp = q.type === 'QRM' && q.maxChoix > 1 && q.maxChoix < q.propositions.length;
    const type = qrp ? 'QRP' : q.type === 'QRM' && nbBonnes === 1 ? 'QRU' : q.type;
    d.questions.push({
      qti_id: q.id,
      type,
      nb_reponses: qrp ? q.maxChoix : null,
      coefficient: Math.max(1, Math.round(q.coefficient || 1)),
      enonce: q.enonce || '',
      propositions: q.propositions.map((p) => ({ id: p.id, texte: p.texte })),
      correction: {
        bonnes: q.propositions.filter((p) => p.correcte).map((p) => p.id),
        reponses_qroc: q.reponses || [],
        explications: Object.fromEntries(q.propositions.filter((p) => p.explication).map((p) => [p.id, p.explication])),
        commentaire: q.correction || '',
      },
    });
  }
  return dossiers;
}

// Ré-assainit un HTML déjà stocké (défense en profondeur avant affichage).
export function assainir(html) {
  const ctx = { base: '', images: [], media: (p, raw) => raw, warn() {}, note() {} };
  return clean(new DOMParser().parseFromString(String(html ?? ''), 'text/html').body, ctx);
}
