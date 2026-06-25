/**
 * Minimal RFC-4180-ish CSV parser (TODO Stage 7; FR-7). No dependency - the rest
 * of the backend deliberately avoids SDKs (Cloudinary/Expo push are raw REST),
 * and a spreadsheet export is a constrained, well-understood format. Handles
 * quoted fields, embedded commas/newlines, escaped quotes (`""`), and CRLF.
 * Returns rows of raw string cells; column mapping + value parsing live in
 * `lib/import.ts`.
 */

/** Parse CSV text into rows of cells. Fully-empty lines are dropped. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let started = false; // any char seen on the current row (so we don't drop a trailing empty cell)

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Drop a row that is entirely empty (e.g. a blank line between records).
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ',') {
      pushField();
      started = true;
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      // Swallow; the paired \n (or EOF) terminates the row.
    } else {
      field += c;
      started = true;
    }
  }
  // Flush the final field/row when the input doesn't end in a newline.
  if (started || field !== '' || row.length > 0) pushRow();

  return rows;
}
