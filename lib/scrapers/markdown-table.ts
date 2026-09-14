/**
 * Minimal GitHub-flavored markdown table parser.
 *
 * Job-board READMEs (Jobright, SpeedyApply) publish listings as a single
 * pipe-delimited table instead of JSON. Given the full README text, this finds
 * the first such table and returns its DATA rows as arrays of trimmed cell
 * strings — the header row and the `|---|---|` separator are excluded.
 *
 * Intentionally simple: these tables don't use escaped pipes inside cells, so a
 * plain split on "|" is correct. Returns [] when there's no table.
 */
export function parseMarkdownTable(md: string): string[][] {
  const tableLines = md.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  // Need at least header + separator + one data row.
  if (tableLines.length < 3) return [];
  return tableLines
    .slice(1) // drop the header row
    .filter((l) => !isSeparatorRow(l))
    .map(splitRow);
}

/** The `| ----- | --------- |` divider under the header (and any stray ones). */
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}
