export function normalizePlaceQuery(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function editDistance(first: string, second: string) {
  const rows = Array.from({ length: first.length + 1 }, (_, i) =>
    Array.from({ length: second.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= first.length; i += 1) {
    for (let j = 1; j <= second.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(first[i - 1] !== second[j - 1]));
      if (i > 1 && j > 1 && first[i - 1] === second[j - 2] && first[i - 2] === second[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[first.length][second.length];
}

// Short prefixes stay precise; longer words tolerate an insertion, omission,
// substitution or adjacent transposition. Every result is still a real place.
export function rankPlaceMatch(name: string, query: string): number {
  if (!query) return Infinity;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1 + name.split(" ")[0].length / 100;
  if (name.split(" ").some(word => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  const words = name.split(" ");
  const tokens = query.split(" ").filter(token => token !== "nj");
  if (!tokens.length) return Infinity;
  let score = 4;
  for (const token of tokens) {
    if (words.some(word => word.startsWith(token))) continue;
    if (token.length < 3) return Infinity;
    const distances = words.map(word => editDistance(token, word));
    const distance = Math.min(...distances);
    if (distance > (token.length >= 7 ? 2 : 1)) return Infinity;
    score += distance + distances.indexOf(distance) / 100;
  }
  return score;
}
