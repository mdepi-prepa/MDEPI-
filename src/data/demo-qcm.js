// Contenu de démonstration des QCM : le DP4 vient d'un vrai export Théia
// (passé par le parseur, voir tests/fixtures), les KFP sont repris d'une
// relecture Théia de la conf HGE D3.
export const QCM_DEMO = {
 "dp4": [
  {
   "titre": "CONF HGE D3 DP4 (2026-2027)",
   "matiere": "HGE",
   "contexte": "",
   "promo": "D3",
   "questions": [
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302637",
     "type": "QRU",
     "enonce": "<div><p>Vous recevez aux urgences Monsieur B., 71 ans, pour une fièvre à 39 °C accompagnée de frissons, d&#39;une asthénie importante et de douleurs de l&#39;hypochondre droit évoluant depuis 24 heures.<br>Il présente comme antécédents un diabète de type 2 et une hypertension artérielle.<br>À l&#39;interrogatoire, vous apprenez qu&#39;il a bénéficié, cinq mois auparavant, d&#39;une CPRE pour une lithiase de la voie biliaire principale. L&#39;extraction complète des calculs ayant été impossible, une prothèse biliaire plastique temporaire avait été mise en place pour assurer le drainage. Une nouvelle CPRE était programmée six semaines plus tard, mais le patient ne s&#39;est pas présenté. La vésicule biliaire est toujours en place.<br><br>À l&#39;examen clinique :<br>TA 115/70 mmHg, FC 108/min, T°39 °C, FR 22/min, SpO₂ 97 % en air ambiant<br>L&#39;abdomen est souple, sensible dans l&#39;hypochondre droit, sans défense. Il n&#39;existe pas d&#39;ictère cutanéo-muqueux franc.<br>Le bilan biologique retrouve : leucocytes 17,5 G/L, CRP 145 mg/L, ASAT 135 UI/L, ALAT 165 UI/L, PAL 360 UI/L, GGT 480 UI/L, bilirubine totale 42 µmol/L et conjuguée 32 µmol/L.<br>Q1 : Quel est le diagnostic le plus probable ? </p></div>",
     "propositions": [
      {
       "id": "CHOICE_9017980",
       "texte": "Une cholécystite aiguë lithiasique"
      },
      {
       "id": "CHOICE_9017981",
       "texte": "Une angiocholite aiguë sur obstruction de prothèse biliaire"
      },
      {
       "id": "CHOICE_9017982",
       "texte": "Une pancréatite aiguë"
      },
      {
       "id": "CHOICE_9017983",
       "texte": "Une hépatite virale aiguë"
      },
      {
       "id": "CHOICE_9017984",
       "texte": "Une colique hépatique simple"
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9017981"
      ],
      "reponses_qroc": [],
      "explications": {},
      "commentaire": "<div><p><span class=\"c-ok\">Le diagnostic </span><span class=\"c-ok\"><strong>d&#39;angiocholite</strong></span><span class=\"c-ok\"> est fortement suspecté devant l&#39;association d&#39;un syndrome infectieux et d&#39;une cholestase biologique, sur un terrain d&#39;instrumentation biliaire.</span></p> <p><span class=\"c-ok\"><strong>L&#39;absence d’un </strong></span><span class=\"c-ok\"><strong>franc</strong></span><span class=\"c-ok\"><strong> </strong></span><span class=\"c-ok\"><strong>ictère </strong></span><span class=\"c-ok\"><strong>clinique n&#39;élimine pas une angiocholite débutante</strong></span><span class=\"c-ok\">. La triade de Charcot (douleur, fièvre, ictère) est </span><span class=\"c-ok\"><strong>inconstante</strong></span><span class=\"c-ok\">.</span></p></div>"
     }
    },
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302645",
     "type": "QRM",
     "enonce": "<div><p><strong> </strong>Q2 : Une échographie abdominale est réalisée. Elle retrouve une vésicule lithiasique sans signe de cholécystite, et une dilatation modérée des voies biliaires intrahépatiques. L&#39;analyse de la prothèse et du bas cholédoque est difficile.<br>Concernant les explorations complémentaires, quelles propositions sont exactes ?</p></div>",
     "propositions": [
      {
       "id": "CHOICE_9018001",
       "texte": "L&#39;échographie abdominale est l&#39;examen d&#39;imagerie de première intention."
      },
      {
       "id": "CHOICE_9018002",
       "texte": "Un scanner abdomino-pelvien injecté peut être réalisé pour rechercher une obstruction et ses complications."
      },
      {
       "id": "CHOICE_9018003",
       "texte": "L&#39;absence de calcul visible à l&#39;échographie élimine une angiocholite."
      },
      {
       "id": "CHOICE_9018004",
       "texte": "Une bili-IRM est systématiquement indispensable avant la réalisation d&#39;une CPRE."
      },
      {
       "id": "CHOICE_9018005",
       "texte": "La présence d&#39;une prothèse biliaire en place garantit la perméabilité des voies biliaires."
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9018001",
       "CHOICE_9018002"
      ],
      "reponses_qroc": [],
      "explications": {
       "CHOICE_9018003": "Faux ! Ils ne sont pas toujours visibles.",
       "CHOICE_9018004": "Faux, particulièrement en situation d’urgence",
       "CHOICE_9018005": "Faux ! Une prothèse peut s&#39;obstruer par du sludge, des débris ou du biofilm…"
      },
      "commentaire": ""
     }
    },
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302649",
     "type": "QRM",
     "enonce": "<div><p><strong> </strong>Q3 : Un scanner abdomino-pelvien injecté est réalisé.<br>Il retrouve une dilatation de la voie biliaire principale à 13 mm et des voies biliaires intrahépatiques, malgré la présence de la prothèse. Il n&#39;existe pas de collection hépatique individualisée.<br>L&#39;ensemble est évocateur d&#39;une obstruction de la prothèse biliaire, responsable d&#39;une angiocholite aiguë.<br>Quelles mesures doivent être mises en œuvre immédiatement ?</p></div>",
     "propositions": [
      {
       "id": "CHOICE_9018011",
       "texte": "Réalisation d&#39;hémocultures avant l&#39;antibiothérapie si cela ne retarde pas son administration."
      },
      {
       "id": "CHOICE_9018012",
       "texte": "Attendre les résultats des hémocultures avant de débuter le traitement antibiotique."
      },
      {
       "id": "CHOICE_9018013",
       "texte": "Introduction rapide d&#39;une antibiothérapie probabiliste intraveineuse adaptée aux infections biliaires."
      },
      {
       "id": "CHOICE_9018014",
       "texte": "Hydratation intraveineuse adaptée avec surveillance hémodynamique et biologique rapprochée."
      },
      {
       "id": "CHOICE_9018015",
       "texte": "<span class=\"c-ko\">Réalisation d&#39;une cholécystectomie en urgence comme premier geste thérapeutique.</span>"
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9018011",
       "CHOICE_9018013",
       "CHOICE_9018014"
      ],
      "reponses_qroc": [],
      "explications": {},
      "commentaire": ""
     }
    },
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302653",
     "type": "QRM",
     "enonce": "<div><p><strong> </strong>Q4 : Quelques heures après son admission, malgré l&#39;antibiothérapie et le remplissage initial, le patient présente une dégradation hémodynamique.<br>Les nouvelles constantes sont :<br>TA 80/45 mmHg, FC 125/min, T° 39,2 °C, FR 28/min, Lactate 3,8 mmol/L<br>Il présente des marbrures et une oligurie.<br>Malgré une réanimation volémique adaptée, une perfusion de noradrénaline est nécessaire pour maintenir une PAM ≥ 65 mmHg.<br>Concernant cette aggravation, quelles propositions sont exactes ?<br></p></div>",
     "propositions": [
      {
       "id": "CHOICE_9018016",
       "texte": "Le patient présente un choc septique."
      },
      {
       "id": "CHOICE_9018017",
       "texte": "Il s&#39;agit d&#39;une angiocholite grave"
      },
      {
       "id": "CHOICE_9018018",
       "texte": "Le patient nécessite une prise en charge en réanimation."
      },
      {
       "id": "CHOICE_9018019",
       "texte": "Le drainage biliaire doit être différé jusqu&#39;à la normalisation des marqueurs inflammatoires."
      },
      {
       "id": "CHOICE_9018020",
       "texte": "L&#39;absence de documentation bactériologique permet d&#39;éliminer une origine septique."
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9018016",
       "CHOICE_9018017",
       "CHOICE_9018018"
      ],
      "reponses_qroc": [],
      "explications": {
       "CHOICE_9018019": "Faux ! Un drainage biliaire en extrême urgence est nécessaire, idéalement dans les 12 heures en cas de choc septique"
      },
      "commentaire": ""
     }
    },
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302655",
     "type": "QRM",
     "enonce": "<div><p><strong>Q5 :</strong> Concernant la prise en charge endoscopique de cette complication, quelles propositions sont exactes ?</p></div>",
     "propositions": [
      {
       "id": "CHOICE_9018021",
       "texte": "La CPRE permet le drainage de la voie biliaire principale."
      },
      {
       "id": "CHOICE_9018022",
       "texte": "Une nouvelle prothèse biliaire peut être mise en place afin d&#39;assurer un drainage efficace."
      },
      {
       "id": "CHOICE_9018023",
       "texte": "L&#39;extraction complète des calculs résiduels est obligatoire lors du geste initial, même chez un patient instable."
      },
      {
       "id": "CHOICE_9018024",
       "texte": "Un prélèvement de bile à visée bactériologique peut être réalisé lors de la CPRE."
      },
      {
       "id": "CHOICE_9018025",
       "texte": "L&#39;antibiothérapie seule est toujours suffisante pour traiter l&#39;infection, même lorsque la prothèse reste obstruée."
      },
      {
       "id": "CHOICE_9018061",
       "texte": "Une antibiothérapie visan"
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9018021",
       "CHOICE_9018022",
       "CHOICE_9018024"
      ],
      "reponses_qroc": [],
      "explications": {
       "CHOICE_9018025": "Faux ! Chez un patient instable, la priorité est de restaurer un drainage efficace. L&#39;extraction complète des calculs peut être réalisée secondairement si elle nécessite une procédure prolongée ou complexe.",
       "CHOICE_9018061": "BUG D’ENONCE ! STAY FOCUS"
      },
      "commentaire": ""
     }
    },
    {
     "qti_id": "MULTIPLECHOICE_QUESTION_4302666",
     "type": "QRM",
     "enonce": "<div><p><strong> </strong>Q6 : L&#39;évolution est favorable après drainage biliaire, antibiothérapie et prise en charge en réanimation.<br>Le patient est désormais apyrétique et stable sur le plan hémodynamique.<br>Une nouvelle prothèse biliaire plastique temporaire a été mise en place. Plusieurs calculs résiduels restent présents dans la voie biliaire principale.<br>Quelles propositions sont exactes concernant la prise en charge ultérieure ?</p></div>",
     "propositions": [
      {
       "id": "CHOICE_9018056",
       "texte": "Une nouvelle CPRE doit être programmée pour obtenir la clairance de la voie biliaire principale et retirer la prothèse temporaire."
      },
      {
       "id": "CHOICE_9018057",
       "texte": "La prothèse plastique peut être conservée définitivement sans surveillance puisque le patient est asymptomatique."
      },
      {
       "id": "CHOICE_9018058",
       "texte": "Une cholécystectomie doit être proposée après stabilisation clinique et traitement de l&#39;obstacle cholédocien, si le patient est opérable."
      },
      {
       "id": "CHOICE_9018059",
       "texte": "La résolution de l&#39;infection après antibiothérapie garantit l&#39;absence de récidive."
      },
      {
       "id": "CHOICE_9018060",
       "texte": "Le patient doit être informé de la nécessité d&#39;un retrait ou d&#39;un échange programmé de sa prothèse biliaire."
      }
     ],
     "correction": {
      "bonnes": [
       "CHOICE_9018056",
       "CHOICE_9018058",
       "CHOICE_9018060"
      ],
      "reponses_qroc": [],
      "explications": {
       "CHOICE_9018057": "Faux ! Risque de nouvelle obstruction et de récidive d’angiocholite",
       "CHOICE_9018060": "Vrai ! Ce changement ou retrait doit avoir lieu dans les 3 à 6 mois (pas à savoir)"
      },
      "commentaire": ""
     }
    }
   ]
  }
 ],
 "kfp1": [
  {
   "titre": "CONF HGE D3 KFP1 (2026-2027)",
   "matiere": "HGE",
   "contexte": "",
   "promo": "D3",
   "questions": [
    {
     "qti_id": "DEMO_KFP1_Q1",
     "type": "QRU",
     "enonce": "<p>Vous recevez aux urgences Monsieur B., 58 ans, pour une asthénie intense, des nausées, une douleur en épigastre/hypochondre droit et un ictère cutanéo-muqueux apparus depuis 48 heures.<br>Il n'a pas d'antécédent particulier, ne prend aucun traitement et ne rapporte aucune consommation d'alcool. Il n'a pas voyagé récemment.<br>Le bilan biologique retrouve :<br>ASAT : 1 250 UI/L (N &lt; 40) ; ALAT : 1 860 UI/L (N &lt; 40)<br>Bilirubine totale : 82 µmol/L<br>PAL : 145 UI/L ; GGT : 180 UI/L<br>Constantes : FC 86 bpm, TA 135/89, Sat 98 % et T° 36,6 °C<br>Q1 : Avec ces éléments, que pouvez-vous conclure ?</p>",
     "propositions": [
      {
       "id": "P1",
       "texte": "Il s'agit d'une hépatite aiguë sévère du fait des transaminases supérieures à 1 000 UI/L."
      },
      {
       "id": "P2",
       "texte": "Il s'agit d'une hépatite aiguë grave devant l'importance de l'hyperbilirubinémie."
      },
      {
       "id": "P3",
       "texte": "Une hépatite aiguë sévère est exclue en l'absence de signes neurologiques rapportés."
      },
      {
       "id": "P4",
       "texte": "Il est impossible de préciser la gravité de cette hépatite sans connaître le TP et évaluer l'état neurologique du patient."
      },
      {
       "id": "P5",
       "texte": "Il s'agit d'une hépatite fulminante devant l'apparition récente d'un ictère."
      }
     ],
     "correction": {
      "bonnes": [
       "P4"
      ],
      "reponses_qroc": [],
      "explications": {},
      "commentaire": "<p><span class=\"c-ko\">A. Faux :</span> l'importance de la cytolyse n'est pas un critère de gravité.<br><span class=\"c-ko\">B. Faux :</span> l'hyperbilirubinémie ne définit pas une hépatite aiguë grave.<br><span class=\"c-ko\">C. Faux :</span> une hépatite aiguë sévère peut exister sans encéphalopathie.<br><span class=\"c-ok\">D. Vrai :</span> il faut évaluer la fonction hépatique (TP, facteur V) et rechercher une encéphalopathie hépatique.<br><span class=\"c-ko\">E. Faux :</span> une hépatite fulminante nécessite une encéphalopathie hépatique apparaissant dans les deux semaines suivant l'ictère.</p>"
     }
    },
    {
     "qti_id": "DEMO_KFP1_Q2",
     "type": "QRM",
     "enonce": "<p>Le patient dort bien la nuit, a un bon contact, pas de flapping. Il rapporte avoir consommé du figatellu insuffisamment cuit quelques semaines auparavant.<br>TP : 85 % ; facteur V : 90 %<br>Q2 : Vous suspectez une hépatite virale aiguë non sévère. Parmi les expositions suivantes, lesquelles constituent des facteurs de risque de transmission de l'hépatite E en France ?</p>",
     "propositions": [
      {
       "id": "P1",
       "texte": "Consommation de viande de porc insuffisamment cuite"
      },
      {
       "id": "P2",
       "texte": "Partage de matériel d'injection intraveineuse"
      },
      {
       "id": "P3",
       "texte": "Consommation de gibier insuffisamment cuit"
      },
      {
       "id": "P4",
       "texte": "Rapports sexuels non protégés"
      },
      {
       "id": "P5",
       "texte": "Contact avec une personne infectée par le VHE"
      }
     ],
     "correction": {
      "bonnes": [
       "P1",
       "P3"
      ],
      "reponses_qroc": [],
      "explications": {},
      "commentaire": "<p>Transmission zoonotique alimentaire et féco-orale.</p>"
     }
    },
    {
     "qti_id": "DEMO_KFP1_Q3",
     "type": "QRM",
     "enonce": "<p>Q3 : Quels examens complémentaires prescrivez-vous en première intention ?</p>",
     "propositions": [
      {
       "id": "P1",
       "texte": "Sérologie IgM anti-VHA"
      },
      {
       "id": "P2",
       "texte": "Sérologie IgM anti-CMV"
      },
      {
       "id": "P3",
       "texte": "Ag HBs et IgM anti-HBc"
      },
      {
       "id": "P4",
       "texte": "Échographie-Doppler hépatique"
      },
      {
       "id": "P5",
       "texte": "Sérologies HSV et VZV"
      },
      {
       "id": "P6",
       "texte": "Sérologie anti-VHC et recherche de l'ARN VHC"
      },
      {
       "id": "P7",
       "texte": "Sérologie IgM anti-EBV"
      },
      {
       "id": "P8",
       "texte": "Sérologie IgM anti-VHE"
      }
     ],
     "correction": {
      "bonnes": [
       "P1",
       "P3",
       "P4",
       "P6",
       "P8"
      ],
      "reponses_qroc": [],
      "explications": {},
      "commentaire": ""
     }
    }
   ]
  }
 ],
 "kfp2": [
  {
   "titre": "CONF HGE D3 KFP2 (2026-2027)",
   "matiere": "HGE",
   "contexte": "",
   "promo": "D3",
   "questions": [
    {
     "qti_id": "DEMO_KFP2_Q1",
     "type": "QROC",
     "enonce": "<p>De garde aux urgences, vous recevez Robert, 52 ans, pour un tableau de douleur abdominale fébrile. Antécédents : HTA sous amlodipine, diabète sous metformine, dyslipidémie sous atorvastatine.<br>Depuis 2 jours : fièvre à 38,4 °C et douleur en fosse iliaque gauche avec constipation. Abdomen souple mais sensible en FIG. Bandelette urinaire négative.<br>FC 99 bpm, TA 134/87, Sat 98 %, FR 17/min<br>Hb 11,9 g/dL, PNN 9,4 G/L, plaquettes 470 G/L, CRP 75 mg/L, créatinine 56 µmol/L<br>Q1 : Dans ce contexte, quel examen demandez-vous en première intention ? (QROC)</p>",
     "propositions": [],
     "correction": {
      "bonnes": [],
      "reponses_qroc": [
       "TDM AP injecté",
       "Scanner abdomino-pelvien injecté",
       "Scanner AP injecté",
       "Scanner abdominopelvien injecté",
       "Scanner abdomino-pelvien avec injection",
       "TDM abdominopelvien injecté",
       "Scanner abdominal injecté",
       "Tomodensitométrie abdomino-pelvienne injectée"
      ],
      "explications": {},
      "commentaire": ""
     }
    },
    {
     "qti_id": "DEMO_KFP2_Q2",
     "type": "QROC",
     "enonce": "<p>Vous réalisez un TDM AP injecté. Une coupe retient l'attention du radiologue.<br>Q2 : Quel diagnostic évoquez-vous ? (QROC)</p>",
     "propositions": [],
     "correction": {
      "bonnes": [],
      "reponses_qroc": [
       "Diverticulite",
       "Diverticulite simple",
       "Diverticulite non compliquée",
       "Diverticulite aiguë",
       "Diverticulite aiguë sigmoïdienne",
       "Diverticulite sigmoïdienne",
       "Sigmoïdite"
      ],
      "explications": {},
      "commentaire": ""
     }
    }
   ]
  }
 ]
};
