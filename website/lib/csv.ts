import type { ImportCandidate } from "@/lib/api";

/**
 * Parse a pasted/uploaded CSV into import candidates (the web fallback for the
 * native contacts picker). Header-driven and forgiving: a `name` column plus
 * either `month`+`day` (+ optional `year`) or a single `birthday`/`date` column
 * (MM/DD/YYYY, MM/DD, or YYYY-MM-DD). Optional `relationship`/`tag` and `phone`.
 * Simple comma split — quoted commas aren't supported (documented in the UI).
 */
export function parseCsv(text: string): ImportCandidate[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const iName = col("name", "full name", "fullname");
  const iMonth = col("month");
  const iDay = col("day");
  const iYear = col("year");
  const iDate = col("birthday", "date", "dob");
  const iTag = col("relationship", "tag", "relationshiptag");
  const iPhone = col("phone", "mobile", "number");

  const candidates: ImportCandidate[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((c) => c.trim());
    const name = iName >= 0 ? cells[iName] : "";
    if (!name) continue;

    let dob: ImportCandidate["dob"] = null;
    if (iMonth >= 0 && iDay >= 0) {
      const month = Number(cells[iMonth]);
      const day = Number(cells[iDay]);
      const year = iYear >= 0 && cells[iYear] ? Number(cells[iYear]) : null;
      if (month && day) dob = { month, day, year };
    } else if (iDate >= 0 && cells[iDate]) {
      dob = parseDate(cells[iDate]);
    }

    candidates.push({
      name,
      relationshipTag: iTag >= 0 ? cells[iTag] || null : null,
      phone: iPhone >= 0 ? cells[iPhone] || null : null,
      dob,
    });
  }
  return candidates;
}

function parseDate(value: string): ImportCandidate["dob"] {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return { month: Number(iso[2]), day: Number(iso[3]), year: Number(iso[1]) };
  const us = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (us) {
    return {
      month: Number(us[1]),
      day: Number(us[2]),
      year: us[3] ? Number(us[3].length === 2 ? `19${us[3]}` : us[3]) : null,
    };
  }
  return null;
}
