/**
 * Minimal YAML reader for the spec subset used in qa/specs/screens/*.yaml:
 * nested maps, lists of scalars, lists of maps, inline flow arrays, comments.
 *
 * Deliberately dependency-free. The repo's node_modules lives on a mounted
 * filesystem where module resolution is pathologically slow, and a QA harness
 * that takes 30s to load its own parser will not get run.
 */
const scalar = (raw) => {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((x) => scalar(x));
  }
  if (/^["'].*["']$/.test(v)) return v.slice(1, -1);
  return v;
};

export function parseYaml(text) {
  // (indent, key|null, inlineValue|null, isListItem)
  const lines = [];
  for (const raw of text.split("\n")) {
    const noComment = raw.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim()) continue;
    lines.push({ indent: noComment.match(/^ */)[0].length, text: noComment.trim() });
  }

  let i = 0;
  function parseBlock(indent) {
    // A block is either a sequence (all "- ") or a mapping.
    if (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith("- ")) {
      const arr = [];
      while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith("- ")) {
        const item = lines[i].text.slice(2).trim();
        const kv = item.match(/^([\w.$-]+):\s*(.*)$/);
        if (!kv) { i++; arr.push(scalar(item)); continue; }
        // First key sits on the dash line; the rest are indented to align past it.
        const obj = {};
        const childIndent = indent + 2;
        const [, k, v] = kv;
        i++;
        obj[k] = v ? scalar(v) : (lines[i]?.indent > childIndent ? parseBlock(lines[i].indent) : null);
        while (i < lines.length && lines[i].indent === childIndent && !lines[i].text.startsWith("- ")) {
          const m = lines[i].text.match(/^([\w.$-]+):\s*(.*)$/);
          if (!m) break;
          i++;
          obj[m[1]] = m[2] ? scalar(m[2]) : (lines[i]?.indent > childIndent ? parseBlock(lines[i].indent) : null);
        }
        arr.push(obj);
      }
      return arr;
    }

    const obj = {};
    while (i < lines.length && lines[i].indent === indent) {
      const m = lines[i].text.match(/^([\w.$-]+):\s*(.*)$/);
      if (!m) break;
      const [, k, v] = m;
      i++;
      if (v) obj[k] = scalar(v);
      else if (i < lines.length && lines[i].indent > indent) obj[k] = parseBlock(lines[i].indent);
      else obj[k] = null;
    }
    return obj;
  }

  return parseBlock(lines[0]?.indent ?? 0);
}
