import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import texmath from 'markdown-it-texmath';
import katex from 'katex';

const renderCache = new Map();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(source, language) {
    if (language && language.toLowerCase() === 'mermaid') {
      return `<div class="mermaid">${md.utils.escapeHtml(source)}</div>`;
    }
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(source, {
          language,
          ignoreIllegals: true
        }).value}</code></pre>`;
      } catch { }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(source)}</code></pre>`;
  }
}).use(texmath, {
  engine: katex,
  delimiters: ['dollars', 'brackets'],
  katexOptions: { throwOnError: false }
});

const defaultLinkOpen = md.renderer.rules.link_open
  || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noopener noreferrer');
  return defaultLinkOpen(tokens, index, options, env, self);
};

const sanitizeOptions = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'del', 'sup', 'sub', 'blockquote', 'a', 'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'div', 'span', 'code', 'pre', 'hr',
    'eq', 'eqn', 'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
    'mfrac', 'msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover',
    'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mpadded', 'mspace', 'mstyle', 'menclose',
    'svg', 'g', 'path', 'line', 'circle', 'ellipse', 'rect', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'marker', 'clipPath', 'use', 'foreignObject', 'image',
    'title', 'desc'
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'id', 'title', 'role', 'tabindex',
    'href', 'target', 'rel', 'src', 'alt',
    'xmlns', 'encoding', 'aria-hidden', 'data-*', 'mathvariant', 'stretchy', 'fence',
    'separator', 'lspace', 'rspace', 'accent', 'accentunder', 'displaystyle',
    'scriptlevel', 'columnalign', 'rowalign', 'columnspacing', 'rowspacing',
    'columnlines', 'rowlines', 'frame', 'framespacing', 'minsize', 'maxsize', 'movablelimits',
    'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'stroke-dasharray', 'stroke-opacity', 'fill-opacity', 'opacity',
    'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'd',
    'transform', 'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'font-weight',
    'dx', 'dy', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits',
    'marker-end', 'marker-start', 'clip-path', 'xlink:href', 'preserveAspectRatio'
  ],
  ALLOW_DATA_ATTR: true
};

const normalizeMarkdownOutsideFences = (value = '') => {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  let fence = null;

  return lines.map((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      const character = marker[1][0];
      const length = marker[1].length;
      if (!fence) fence = { character, length };
      else if (fence.character === character && length >= fence.length && marker[2].trim() === '') fence = null;
      return line;
    }
    if (fence) return line;

    return line
      .replace(/^(\s{0,3}#{1,6})(?=[^\s#])/u, '$1 ')
      .replace(/^(\s*>\s*)(#{1,6})(?=[^\s#])/u, '$1$2 ');
  }).join('\n');
};

const findStableBlockBoundary = (value = '') => {
  const text = String(value || '');
  const lines = text.split('\n');
  let offset = 0;
  let stableEnd = 0;
  let fence = null;
  let blockMathOpen = false;

  lines.forEach((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      const character = marker[1][0];
      const length = marker[1].length;
      if (!fence) fence = { character, length };
      else if (fence.character === character && length >= fence.length && marker[2].trim() === '') fence = null;
    } else if (!fence && /^\s*\$\$\s*$/.test(line)) {
      blockMathOpen = !blockMathOpen;
    }

    const hasFollowingNewline = index < lines.length - 1;
    offset += line.length + (hasFollowingNewline ? 1 : 0);
    if (!fence && !blockMathOpen && hasFollowingNewline && line.trim() === '') {
      stableEnd = offset;
    }
  });

  return stableEnd;
};

const maskInlineCode = (value = '') => {
  const chars = [...String(value || '')];
  let delimiterLength = 0;
  let index = 0;

  while (index < chars.length) {
    if (chars[index] !== '`') {
      if (delimiterLength > 0 && chars[index] !== '\n') chars[index] = ' ';
      index += 1;
      continue;
    }

    let end = index;
    while (end < chars.length && chars[end] === '`') end += 1;
    const runLength = end - index;
    const closesCode = delimiterLength > 0 && runLength === delimiterLength;
    const opensCode = delimiterLength === 0;

    for (let cursor = index; cursor < end; cursor += 1) chars[cursor] = ' ';
    if (opensCode) delimiterLength = runLength;
    else if (closesCode) delimiterLength = 0;
    index = end;
  }

  return {
    text: chars.join(''),
    openDelimiter: delimiterLength > 0 ? '`'.repeat(delimiterLength) : ''
  };
};

const inspectMarkdownStructure = (value = '') => {
  const lines = String(value || '').split('\n');
  const outsideFence = [];
  let fence = null;

  lines.forEach((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      outsideFence.push('');
      return;
    }

    if (fence) {
      if (marker
        && marker[1][0] === fence.character
        && marker[1].length >= fence.length
        && marker[2].trim() === '') {
        fence = null;
      }
      outsideFence.push('');
      return;
    }

    outsideFence.push(line);
  });

  const inlineCode = maskInlineCode(outsideFence.join('\n'));

  return {
    fence,
    inlineSafeText: inlineCode.text,
    inlineCodeDelimiter: inlineCode.openDelimiter
  };
};

const countUnescaped = (value, token) => {
  let count = 0;
  let index = 0;
  while (index <= value.length - token.length) {
    if (value.slice(index, index + token.length) === token && value[index - 1] !== '\\') {
      count += 1;
      index += token.length;
    } else index += 1;
  }
  return count;
};

const maskDelimitedContent = (value = '', token) => {
  const source = String(value || '');
  let result = '';
  let inside = false;
  let index = 0;

  while (index < source.length) {
    const isDelimiter = source.slice(index, index + token.length) === token
      && source[index - 1] !== '\\';
    if (isDelimiter) {
      result += ' '.repeat(token.length);
      inside = !inside;
      index += token.length;
      continue;
    }
    result += inside && source[index] !== '\n' ? ' ' : source[index];
    index += 1;
  }

  return result;
};

const hideIncompleteTableFragment = (value = '') => {
  const lines = String(value || '').split('\n');
  const tableRowIndex = lines.findIndex((line) => /^\s*\|/.test(line));
  if (tableRowIndex < 0) return value;

  const delimiterPattern = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
  const hasDelimiter = lines.slice(tableRowIndex + 1).some((line) => delimiterPattern.test(line));
  if (hasDelimiter) return value;

  return lines.slice(0, tableRowIndex).join('\n').trimEnd();
};

const completeOpenMarkdown = (value = '') => {
  let text = value;
  const structure = inspectMarkdownStructure(text);
  const blockMathSafeText = maskDelimitedContent(structure.inlineSafeText, '$$');

  if (structure.fence) {
    text += `\n${structure.fence.character.repeat(structure.fence.length)}`;
  }
  if (!structure.fence && structure.inlineCodeDelimiter) {
    text += structure.inlineCodeDelimiter;
  }
  if (countUnescaped(structure.inlineSafeText, '$$') % 2 === 1) text += '\n$$';
  if (countUnescaped(blockMathSafeText, '**') % 2 === 1) text += '**';
  if (countUnescaped(blockMathSafeText, '__') % 2 === 1) text += '__';

  return text;
};

const completeStreamingTail = (value = '') => {
  let text = normalizeMarkdownOutsideFences(value);

  // A marker-only final line is a protocol fragment, not yet readable content.
  text = text.replace(/(?:^|\n)\s{0,3}(?:#{1,6}|\*{1,2}|_{1,2}|`{1,3}|~{3,})\s*$/u, '');
  text = hideIncompleteTableFragment(text);
  return completeOpenMarkdown(text);
};

export const normalizeCompletedMarkdown = (value = '') => {
  const text = normalizeMarkdownOutsideFences(value).trim();
  return completeOpenMarkdown(text);
};

const wrapRenderedTables = (html = '') => html
  .replace(/<table>/g, '<div class="table-container"><table>')
  .replace(/<\/table>/g, '</table></div>');

const sanitizeRenderedHtml = (html = '') => wrapRenderedTables(
  DOMPurify.sanitize(html, sanitizeOptions)
);

export const renderMarkdown = (value, options = {}) => {
  if (!value) return '';
  const streaming = typeof options === 'boolean' ? options : Boolean(options.streaming);
  const rawText = String(value);
  const cacheKey = rawText;

  if (!streaming && renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  let html = '';
  if (streaming) {
    const stableEnd = findStableBlockBoundary(rawText);
    const stableSource = normalizeCompletedMarkdown(rawText.slice(0, stableEnd));
    const tailSource = completeStreamingTail(rawText.slice(stableEnd));
    const stableHtml = stableSource ? md.render(stableSource) : '';
    const tailHtml = tailSource ? md.render(tailSource) : '';
    html = `${stableHtml}${tailHtml ? `<div class="md-stream-tail">${tailHtml}</div>` : ''}`;
  } else {
    html = md.render(normalizeCompletedMarkdown(rawText));
  }

  const result = sanitizeRenderedHtml(html);
  if (!streaming) {
    if (renderCache.size > 200) renderCache.clear();
    renderCache.set(cacheKey, result);
  }
  return result;
};

export const clearMarkdownRenderCache = () => renderCache.clear();
