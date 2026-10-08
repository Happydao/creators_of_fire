// Published Google Form schema inspected on 2026-10-08. Keep the Italian values exact.
export const requestForm = {
  action: 'https://docs.google.com/forms/d/e/1FAIpQLSdo7egdDxBU6npUnDzRpLk6rSR-8VO3Zzq5MHFqspndwcef2g/formResponse',
  view: 'https://docs.google.com/forms/d/e/1FAIpQLSdo7egdDxBU6npUnDzRpLk6rSR-8VO3Zzq5MHFqspndwcef2g/viewform',
  fields: {
    name: { entry: 'entry.1770471919', required: true },
    email: { entry: 'entry.1045781291', required: false },
    title: { entry: 'entry.2005620554', required: false },
    instrumental: { entry: 'entry.773644728', required: true, options: [
      { label: 'Instrumental only', value: 'Si, solo strumentale' },
      { label: 'With vocals', value: 'No, con testo' },
      { label: 'Either is fine', value: 'Indifferente' }
    ] },
    genre: { entry: 'entry.1065046570', required: true, options: [
      { label: 'Rock / Metal', value: 'Rock / Metal' },
      { label: 'Techno / House', value: 'Techno / House' },
      { label: 'Hip-Hop / Trap', value: 'Hip Hop / Trap' },
      { label: 'Pop', value: 'Pop' },
      { label: 'Other', value: '__other_option__' }
    ], otherEntry: 'entry.1065046570.other_option_response' },
    mood: { entry: 'entry.1166974658', required: true, options: [
      { label: 'Energetic', value: 'Energica' },
      { label: 'Sad', value: 'Triste' },
      { label: 'Epic', value: 'Epica' },
      { label: 'Dark', value: 'Oscura' },
      { label: 'Happy', value: 'Allegra' },
      { label: 'Motivational', value: 'Motivazionale' }
    ] },
    description: { entry: 'entry.2132155758', required: true },
    consent: { entry: 'entry.1362083836', required: true, value: 'Accetto le condizioni' }
  }
};
export function mappedRequest(values) {
  const params = new URLSearchParams({ fvv: '1', pageHistory: '0', draftResponse: '[]' });
  for (const [key, field] of Object.entries(requestForm.fields)) {
    const value = values[key];
    if (field.required && !value) throw new Error(`Missing required field: ${key}`);
    if (!value) continue;
    if (field.options && !field.options.some(option => option.value === value)) throw new Error(`Invalid option for ${key}`);
    params.append(field.entry, key === 'consent' ? field.value : value);
    if (key === 'genre' && value === '__other_option__') {
      if (!values.otherGenre?.trim()) throw new Error('Missing custom genre');
      params.append(field.otherEntry, values.otherGenre.trim());
    }
  }
  return params;
}
