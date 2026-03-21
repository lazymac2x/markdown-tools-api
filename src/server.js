const express = require('express');
const cors = require('cors');
const converter = require('./converter');

const app = express();
const PORT = process.env.PORT || 3900;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Health ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'markdown-tools-api', version: '1.0.0' });
});

// ── Helpers ──────────────────────────────────────────────────────
function requireBody(field) {
  return (req, res, next) => {
    if (!req.body || typeof req.body[field] !== 'string' || req.body[field].trim() === '') {
      return res.status(400).json({ error: `"${field}" (string) is required in the request body.` });
    }
    next();
  };
}

// ── POST /api/v1/md-to-html ─────────────────────────────────────
app.post('/api/v1/md-to-html', requireBody('markdown'), (req, res) => {
  const html = converter.mdToHtml(req.body.markdown);
  res.json({ html });
});

// ── POST /api/v1/html-to-md ─────────────────────────────────────
app.post('/api/v1/html-to-md', requireBody('html'), (req, res) => {
  const markdown = converter.htmlToMd(req.body.html);
  res.json({ markdown });
});

// ── POST /api/v1/md-to-text ─────────────────────────────────────
app.post('/api/v1/md-to-text', requireBody('markdown'), (req, res) => {
  const text = converter.mdToText(req.body.markdown);
  res.json({ text });
});

// ── POST /api/v1/extract-toc ────────────────────────────────────
app.post('/api/v1/extract-toc', requireBody('markdown'), (req, res) => {
  const toc = converter.extractToc(req.body.markdown);
  res.json({ toc });
});

// ── POST /api/v1/extract-links ──────────────────────────────────
app.post('/api/v1/extract-links', requireBody('markdown'), (req, res) => {
  const links = converter.extractLinks(req.body.markdown);
  res.json({ links });
});

// ── POST /api/v1/extract-code ───────────────────────────────────
app.post('/api/v1/extract-code', requireBody('markdown'), (req, res) => {
  const blocks = converter.extractCode(req.body.markdown);
  res.json({ blocks });
});

// ── POST /api/v1/stats ──────────────────────────────────────────
app.post('/api/v1/stats', requireBody('markdown'), (req, res) => {
  const result = converter.stats(req.body.markdown);
  res.json(result);
});

// ── POST /api/v1/lint ───────────────────────────────────────────
app.post('/api/v1/lint', requireBody('markdown'), (req, res) => {
  const result = converter.lint(req.body.markdown);
  res.json(result);
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`markdown-tools-api running on http://localhost:${PORT}`);
});

module.exports = app;
