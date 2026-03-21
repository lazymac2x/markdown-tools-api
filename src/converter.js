const { marked } = require('marked');
const TurndownService = require('turndown');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// ── Markdown → HTML ──────────────────────────────────────────────
function mdToHtml(markdown) {
  return marked.parse(markdown);
}

// ── HTML → Markdown ──────────────────────────────────────────────
function htmlToMd(html) {
  return turndown.turndown(html);
}

// ── Markdown → Plain text (strip all formatting) ────────────────
function mdToText(markdown) {
  const html = marked.parse(markdown);
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Extract headings / TOC ──────────────────────────────────────
function extractToc(markdown) {
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ level, text, slug });
  }
  return headings;
}

// ── Extract all links ───────────────────────────────────────────
function extractLinks(markdown) {
  const links = [];
  // Inline links: [text](url "title")
  const inlineRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  let m;
  while ((m = inlineRe.exec(markdown)) !== null) {
    links.push({ text: m[1], url: m[2], title: m[3] || null });
  }
  // Reference links: [text][ref]  then [ref]: url
  const refDefRe = /^\[([^\]]+)\]:\s+(\S+)(?:\s+"([^"]*)")?$/gm;
  const refDefs = {};
  while ((m = refDefRe.exec(markdown)) !== null) {
    refDefs[m[1].toLowerCase()] = { url: m[2], title: m[3] || null };
  }
  const refUseRe = /\[([^\]]*)\]\[([^\]]*)\]/g;
  while ((m = refUseRe.exec(markdown)) !== null) {
    const key = (m[2] || m[1]).toLowerCase();
    if (refDefs[key]) {
      links.push({ text: m[1], url: refDefs[key].url, title: refDefs[key].title });
    }
  }
  // Autolinks: <https://...>
  const autoRe = /<(https?:\/\/[^>]+)>/g;
  while ((m = autoRe.exec(markdown)) !== null) {
    links.push({ text: m[1], url: m[1], title: null });
  }
  return links;
}

// ── Extract code blocks ─────────────────────────────────────────
function extractCode(markdown) {
  const blocks = [];
  const fencedRe = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = fencedRe.exec(markdown)) !== null) {
    blocks.push({ language: m[1] || null, code: m[2].trimEnd() });
  }
  // Indented code blocks (4 spaces or 1 tab)
  const lines = markdown.split('\n');
  let buf = [];
  for (const line of lines) {
    if (/^(?: {4}|\t)/.test(line)) {
      buf.push(line.replace(/^(?: {4}|\t)/, ''));
    } else {
      if (buf.length > 0) {
        blocks.push({ language: null, code: buf.join('\n').trimEnd() });
        buf = [];
      }
    }
  }
  if (buf.length > 0) {
    blocks.push({ language: null, code: buf.join('\n').trimEnd() });
  }
  return blocks;
}

// ── Stats: word count, reading time, heading count ──────────────
function stats(markdown) {
  const text = mdToText(markdown);
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = extractToc(markdown).length;
  const links = extractLinks(markdown).length;
  const codeBlocks = extractCode(markdown).length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));
  return {
    words,
    characters: text.length,
    headings,
    links,
    codeBlocks,
    readingTimeMin,
  };
}

// ── Lint / validate ─────────────────────────────────────────────
function lint(markdown) {
  const warnings = [];
  const lines = markdown.split('\n');

  // 1. Broken inline link syntax: [text]( )  or  [text](
  const brokenLink = /\[[^\]]*\]\(\s*\)/g;
  let m;
  while ((m = brokenLink.exec(markdown)) !== null) {
    warnings.push({ rule: 'empty-link-url', message: `Empty link URL: ${m[0]}`, offset: m.index });
  }

  // 2. Unclosed inline code
  lines.forEach((line, i) => {
    const backticks = (line.match(/`/g) || []).length;
    if (backticks % 2 !== 0) {
      // Skip if inside a fenced block (rough check)
      if (!/^```/.test(line)) {
        warnings.push({ rule: 'unclosed-inline-code', message: `Possible unclosed inline code`, line: i + 1 });
      }
    }
  });

  // 3. Heading without space after #
  const badHeading = /^(#{1,6})[^#\s]/gm;
  while ((m = badHeading.exec(markdown)) !== null) {
    warnings.push({ rule: 'heading-no-space', message: `Missing space after # in heading`, offset: m.index });
  }

  // 4. Trailing spaces
  lines.forEach((line, i) => {
    if (/[ \t]+$/.test(line) && !/  $/.test(line)) {
      warnings.push({ rule: 'trailing-whitespace', message: `Trailing whitespace`, line: i + 1 });
    }
  });

  // 5. Multiple consecutive blank lines
  let blankRun = 0;
  lines.forEach((line, i) => {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun > 2) {
        warnings.push({ rule: 'multiple-blanks', message: `Excessive blank lines`, line: i + 1 });
      }
    } else {
      blankRun = 0;
    }
  });

  // 6. Reference link defined but never used
  const refDefs = {};
  const refDefRe = /^\[([^\]]+)\]:\s+/gm;
  while ((m = refDefRe.exec(markdown)) !== null) {
    refDefs[m[1].toLowerCase()] = m.index;
  }
  const refUseRe = /\[[^\]]*\]\[([^\]]*)\]/g;
  const usedRefs = new Set();
  while ((m = refUseRe.exec(markdown)) !== null) {
    usedRefs.add(m[1].toLowerCase());
  }
  for (const [key, offset] of Object.entries(refDefs)) {
    if (!usedRefs.has(key)) {
      warnings.push({ rule: 'unused-reference', message: `Unused reference link definition: [${key}]`, offset });
    }
  }

  return { valid: warnings.length === 0, warnings };
}

module.exports = {
  mdToHtml,
  htmlToMd,
  mdToText,
  extractToc,
  extractLinks,
  extractCode,
  stats,
  lint,
};
