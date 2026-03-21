#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) server for markdown-tools-api.
 * Communicates over stdio using JSON-RPC 2.0.
 */

const converter = require('./converter');
const readline = require('readline');

const SERVER_INFO = {
  name: 'markdown-tools',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'md_to_html',
    description: 'Convert Markdown to HTML',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'html_to_md',
    description: 'Convert HTML to Markdown',
    inputSchema: {
      type: 'object',
      properties: { html: { type: 'string', description: 'HTML content' } },
      required: ['html'],
    },
  },
  {
    name: 'md_to_text',
    description: 'Convert Markdown to plain text (strip formatting)',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'extract_toc',
    description: 'Extract table of contents (headings) from Markdown',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'extract_links',
    description: 'Extract all links from Markdown',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'extract_code',
    description: 'Extract code blocks from Markdown',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'stats',
    description: 'Get word count, reading time, heading count from Markdown',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
  {
    name: 'lint',
    description: 'Lint and validate Markdown for common issues',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'Markdown content' } },
      required: ['markdown'],
    },
  },
];

function handleToolCall(name, args) {
  switch (name) {
    case 'md_to_html':
      return { html: converter.mdToHtml(args.markdown) };
    case 'html_to_md':
      return { markdown: converter.htmlToMd(args.html) };
    case 'md_to_text':
      return { text: converter.mdToText(args.markdown) };
    case 'extract_toc':
      return { toc: converter.extractToc(args.markdown) };
    case 'extract_links':
      return { links: converter.extractLinks(args.markdown) };
    case 'extract_code':
      return { blocks: converter.extractCode(args.markdown) };
    case 'stats':
      return converter.stats(args.markdown);
    case 'lint':
      return converter.lint(args.markdown);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function respond(id, result) {
  const msg = { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function respondError(id, code, message) {
  const msg = { jsonrpc: '2.0', id, error: { code, message } };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return respondError(null, -32700, 'Parse error');
  }

  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      return respond(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      // no response needed for notifications
      return;

    case 'tools/list':
      return respond(id, { tools: TOOLS });

    case 'tools/call': {
      try {
        const result = handleToolCall(params.name, params.arguments || {});
        return respond(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return respond(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      return respondError(id, -32601, `Method not found: ${method}`);
  }
});

process.stderr.write('markdown-tools MCP server running on stdio\n');
