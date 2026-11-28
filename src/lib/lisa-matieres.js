// Fiches LiSA (livret.uness.fr) : matière de l'app pour chaque item du
// programme de l'EDN (1 à 367). Le livret LiSA ne donne pas de matière :
// ce classement (une matière par item) est une proposition à ajuster. Pour le
// corriger, déplacez le numéro d'une ligne à l'autre, puis réimportez le
// fichier LiSA dans le back-office (les fiches déjà en place sont mises à jour).
// [a, b] = tous les items de a à b.
const PAR_MATIERE = [
  ["Anapath", [293]],
  ["Anesthésie - Réa", [136]],
  ["Cancérologie", [291, 292, 294, 295]],
  ["Cardiologie", [153, 221, 222, 224, [230, 238], 339]],
  ["Chirurgie digestive", [277, 287, 289, 354, 356, 357]],
  ["Dermatologie", [[111, 117], 171, 187, 228, 302, 350]],
  ["Endocrinologie", [223, [240, 247], 255, 268]],
  ["Gastro-entérologie", [167, 269, [271, 274], 276, [278, 286], 288, 301, [303, 305], 308, 355, 358]],
  ["Gynécologie Obstétrique", [[23, 31], [33, 44], 124, 300, 306, 312, 344]],
  ["Génétique", [22, 45, 46]],
  ["Gériatrie", [123, [130, 133]]],
  ["Hématologie", [[212, 220], 275, 296, [315, 320], 329]],
  ["Immunopathologie", [185, 186, 189, 201, 202]],
  ["Infectiologie", [146, 147, 151, 152, [154, 163], 165, 166, [168, 170], [172, 178], 191, 366]],
  ["MIR - Urgences", [[331, 338], 342, 343]],
  ["MPR", [[118, 120], 122]],
  ["Médecine Interne", [190, [192, 195]]],
  ["Médecine légale - Travail", [5, 7, [11, 14], [182, 184]]],
  ["Médecine vasculaire", [[225, 227], 229, 239]],
  ["Neurochirurgie", [299]],
  ["Neurologie", [[91, 93], [96, 110], 340, 341]],
  ["Nutrition", [[248, 254], 256]],
  ["Néphrologie", [[257, 264], 266, 267, 348]],
  ["ORL", [[87, 90], [148, 150], 298]],
  ["Ophtalmologie", [52, [81, 86]]],
  ["Orthopédie - Trauma", [349, [361, 365]]],
  ["Pneumologie", [188, [203, 211], 309, 359, 360]],
  ["Psychiatrie - Addicto", [15, 58, [60, 80], 121, 144, [351, 353]]],
  ["Pédiatrie", [32, [47, 49], 51, [53, 57], 164, 297, 345, 346]],
  ["Rhumatologie", [94, 95, 128, 129, [196, 200], 307]],
  ["Santé publique", [4, 6, [16, 21], 59, 145, [179, 181], 290, 367]],
  ["Soins palliatifs - Douleurs", [134, 135, [137, 143]]],
  ["Thérapeutique", [[321, 328], 330]],
  ["Transversale", [[1, 3], [8, 10]]],
  ["Urologie", [50, [125, 127], 265, 270, 310, 311, 313, 314, 347]],
];

export const MATIERE_ITEM = new Map();
for (const [matiere, items] of PAR_MATIERE) {
  for (const x of items) {
    if (Array.isArray(x)) for (let n = x[0]; n <= x[1]; n++) MATIERE_ITEM.set(n, matiere);
    else MATIERE_ITEM.set(x, matiere);
  }
}

export function matiereItem(n) {
  return MATIERE_ITEM.get(Number(n)) || '';
}
