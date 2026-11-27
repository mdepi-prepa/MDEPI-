// Fichier .ics pour ajouter une séance à l'agenda du téléphone.

const enUTC = (x) => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const echapperIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);

export function genererIcs(seance, maintenant = new Date()) {
  const description = [seance.matiere, seance.zoom_url ? `Zoom : ${seance.zoom_url}` : ''].filter(Boolean).join('\n');
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MDEPi//App//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${seance.id}@mdepi`,
    `DTSTAMP:${enUTC(maintenant)}`,
    `DTSTART:${enUTC(seance.debut)}`,
    `DTEND:${enUTC(seance.fin)}`,
    `SUMMARY:${echapperIcs(seance.titre)}`,
    `LOCATION:${echapperIcs(seance.lieu)}`,
    description ? `DESCRIPTION:${echapperIcs(description)}` : null,
    seance.annulee ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${echapperIcs(seance.titre)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lignes.join('\r\n') + '\r\n';
}

export function telechargerIcs(seance) {
  const blob = new Blob([genererIcs(seance)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seance-mdepi.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
