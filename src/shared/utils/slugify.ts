/** "São Sebastião" → "sao-sebastiao", "SCIA/Estrutural" → "scia-estrutural". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Accent- and case-insensitive match, so "aguas" finds "Águas Claras". */
export function matchesSearch(name: string, query: string): boolean {
  const normalizedQuery = slugify(query);
  return !normalizedQuery || slugify(name).includes(normalizedQuery);
}
