function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "") : header
  );
  const hasUnnamedTrailingColumn = headers.at(-1) === "";
  if (hasUnnamedTrailingColumn) headers.pop();
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length > 0) {
    throw new Error(`CSV has duplicate headers: ${[...new Set(duplicates)].join(", ")}.`);
  }

  return rows.slice(1).filter((values) => values.some(Boolean)).map((values, rowIndex) => {
    if (hasUnnamedTrailingColumn && values.length === headers.length + 1 && values.at(-1) === "") {
      values.pop();
    }
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

export { parseCsvRows };
