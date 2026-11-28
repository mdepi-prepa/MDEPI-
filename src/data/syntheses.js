// Fiches synthétiques MDEPi : une fiche par item, rédigée à partir de la
// fiche LiSA de l'item (livret.uness.fr, rang A en priorité). Chaque fiche
// tient sur un écran. Une ligne qui commence par « B: » est de rang B.
// **texte** = en gras. Blocs possibles : def, clinique, examens, urgence,
// traitement, retenir (titre par défaut, ou « titre » pour le changer).
export const SYNTHESES = [
  {
    item: 339,
    titre: 'Syndromes coronariens aigus',
    accroche: 'Toute douleur thoracique = **ECG 18 dérivations**. Douleur de repos = appel du **SAMU-Centre 15**.',
    blocs: [
      { type: 'def', lignes: [
        '**IDM** = nécrose ischémique : troponine > 99e percentile + signe d\'ischémie (clinique, ECG, imagerie)',
        '**ST+** = sus-décalage permanent de ST (occlusion complète) · **ST−** = le reste, ECG normal compris',
      ] },
      { type: 'clinique', lignes: [
        'Douleur rétrosternale constrictive, irradiant bras G / mâchoire, de repos, **> 20 min, trinitro-résistante** (ST+)',
        'ST− : plus brève, angor de novo ou crescendo, trinitro-sensible',
        'Atypique (femme, âgé, diabétique) : épigastralgie + nausées, malaise + sueurs, dyspnée',
        'Examen souvent normal : chercher choc, IC, souffle (CIV, IM)',
      ] },
      { type: 'examens', lignes: [
        '**ECG 18 dérivations** (V3R-V4R, V7-V9), répété si douleur persistante',
        'ST+ : sus-décalage ≥ 1 mm dans 2 dérivations contiguës + miroir ; BBG récent = idem',
        'ST− : normal, sous-décalage ST, T négatives ou biphasiques systématisées',
        '**Troponine** : ne retarde pas un ST+ · ST− : H0 puis H1 (us) ou H3, hausse > 30 %',
      ] },
      { type: 'urgence', lignes: [
        'Arrêt cardiaque, choc, TV / BAV haut degré, IC aiguë, douleur ou ST persistants',
      ] },
      { type: 'traitement', lignes: [
        '**ST+ : revasculariser au plus vite** = angioplastie + stent ; fibrinolyse (ténectéplase) si délai > 120 min',
        'SAMU : aspirine 250 mg IV + prasugrel 60 mg ou ticagrelor 180 mg + HNF ou énoxaparine IV ; O2 si SpO2 < 90 %',
        'ST− : aspirine + anticoagulant, coronarographie 24-48 h ; pas de fibrinolyse',
        'Sortie : **bithérapie antiplaquettaire 1 an** puis aspirine à vie, statine forte dose, bêtabloquant, ± IEC, IPP, réadaptation',
      ] },
    ],
  },
  {
    item: 360,
    titre: 'Pneumothorax',
    accroche: 'Épanchement **gazeux** de la cavité pleurale → collapsus pulmonaire partiel ou complet.',
    blocs: [
      { type: 'def', titre: 'Formes', lignes: [
        '**Spontané primaire** : homme jeune longiligne, effort ; tabac favorisant',
        '**Secondaire** : poumon pathologique (emphysème, tuberculose, cancer) · **Traumatique**',
      ] },
      { type: 'clinique', lignes: [
        'Douleur thoracique brutale **« en coup de poignard »**, rythmée par la respiration, ↑ à la toux',
        'Dyspnée, toux sèche ; hémithorax distendu, **tympanisme**, **↓ murmure vésiculaire**',
      ] },
      { type: 'examens', lignes: [
        '**Radio thorax debout, inspiration** : ligne pleurale + hyperclarté sans trame (petit : apex)',
        'Sous tension : poumon rétracté sur le hile, coupole aplatie, médiastin refoulé',
        'Scanner non systématique',
      ] },
      { type: 'urgence', lignes: [
        'Détresse respiratoire ; tamponnade gazeuse : IC droite, choc, arrêt',
        'Gravité **non liée au volume** (insuffisant respiratoire)',
      ] },
      { type: 'traitement', lignes: [
        '**Exsufflation** si sous tension avec gravité ou complet (> 2 cm) : gros cathéter, 2e EIC, ligne médioclaviculaire ; + O2, remplissage, antalgie',
        'B:**Drainage** si échec d\'exsufflation ou PNO secondaire',
        'B:Prévention des récidives : **arrêt du tabac** ± pleurodèse',
      ] },
    ],
  },
  {
    item: 341,
    titre: 'Hémorragie méningée',
    accroche: 'Céphalée **brutale, intense, d\'emblée maximale** = hémorragie méningée jusqu\'à preuve du contraire.',
    blocs: [
      { type: 'def', lignes: [
        'Sang sous-arachnoïdien : **traumatique** (le plus fréquent) ou **spontané**',
        'B:Spontanée = **rupture d\'anévrisme** (85 %) jusqu\'à preuve du contraire',
      ] },
      { type: 'clinique', lignes: [
        '**« Coup de tonnerre dans un ciel serein »** ± céphalée sentinelle (fissuration)',
        'Syndrome méningé **sans fièvre** (peut manquer au début)',
        'HTIC, troubles de conscience → coma, convulsions ; déficit focal, **paralysie du III**',
      ] },
      { type: 'examens', lignes: [
        '**Scanner sans injection** : hyperdensité des espaces sous-arachnoïdiens et citernes de la base',
        'LCR : uniformément rouge, incoagulable, xanthochromique, pigments biliaires (dès H12)',
        'B:Cause : angioscanner cérébral ; **angiographie** = examen de référence',
      ] },
      { type: 'urgence', lignes: [
        'Spontanée = **urgence vitale** → centre de neurochirurgie et neuroradiologie interventionnelle',
        'B:Resaignement, hydrocéphalie aiguë, **vasospasme J4-J14**, HTIC, hyponatrémie, épilepsie',
      ] },
      { type: 'traitement', lignes: [
        'Traitement symptomatique initial : schéma de la fiche LiSA',
        'B:**Sécuriser l\'anévrisme < 72 h** (embolisation ou clipping), décision collégiale',
        'B:Dépister le vasospasme : doppler transcrânien quotidien',
      ] },
    ],
  },
  {
    item: 158,
    titre: 'Sepsis et choc septique',
    accroche: '**Sepsis** = infection + ≥ 1 défaillance d\'organe. Fébrile hypotendu = **choc septique** : traiter sans attendre.',
    blocs: [
      { type: 'def', lignes: [
        '**Choc septique** : vasopresseurs pour PAM ≥ 65 mmHg malgré le remplissage **+ lactates > 2 mmol/L**',
        'Enfant : hypotension tardive (tachycardie compensatrice)',
      ] },
      { type: 'clinique', titre: 'Repérer le patient à risque', lignes: [
        '**qSOFA ≥ 2** : FR ≥ 22/min, PAS ≤ 100 mmHg, conscience altérée (0-1 n\'élimine pas)',
        'Défaillances : hémodynamique, neuro, respiratoire, plaquettes, rein, foie',
        'Hypoperfusion : **marbrures**, TRC allongé, extrémités froides',
        'Terrain : neutropénie, splénectomie, cirrhose ; **nourrisson < 3 mois fébrile**',
      ] },
      { type: 'examens', lignes: [
        '**2 paires d\'hémocultures** en une ponction, avant les antibiotiques',
        'Lactates, iono-créat, bilan hépatique, NFS-plaquettes, radio thorax, ECG',
        'B:Prélèvements orientés selon le site (ECBU, PL…)',
        'CRP / PCT : sans intérêt pour la prise en charge initiale',
      ] },
      { type: 'urgence', titre: 'Purpura fulminans', lignes: [
        '**Purpura fébrile = purpura fulminans** jusqu\'à preuve du contraire',
        '**Ceftriaxone 50 mg/kg** IV ou IM immédiate (ou céfotaxime / amoxicilline 100 mg/kg) ; réanimation',
      ] },
      { type: 'traitement', lignes: [
        'Sans délai, puis réanimateur : 1-2 VVP de bon calibre, scope, sonde urinaire',
        '**Antibiothérapie probabiliste au plus vite** : tout retard ↑ la mortalité',
        'Remplissage par cristalloïdes ; O2 pour SpO2 ≥ 92 %',
        'B:Contrôle de la source (drainage, chirurgie)',
      ] },
    ],
  },
];
