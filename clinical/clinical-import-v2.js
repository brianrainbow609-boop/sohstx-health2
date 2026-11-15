// Clinical importer for SohStx combined CSV, monthly lab CSV,
// clinical review CSV, and existing Clinical JSON files.
(() => {
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && c === ",") {
        row.push(field);
        field = "";
      } else if (!quoted && (c === "\n" || c === "\r")) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
    if (quoted) throw Error("Incomplete
