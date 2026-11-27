import { useMemo } from 'react';

// Лёгкий безопасный рендер Markdown для сообщений чата.
// Поддерживает: **жирный**, *курсив*, `код`, списки «- » и нумерованные,
// переносы строк. БЕЗ HTML/dangerouslySetInnerHTML — только React-узлы,
// поэтому инъекции через ответ модели невозможны.

// Разбор inline-разметки (**bold**, *italic*, `code`) в массив React-узлов.
function renderInline(text, keyPrefix) {
  const nodes = [];
  // Один regex по приоритету: код → жирный → курсив.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-black/20 dark:bg-black/40 text-[0.85em] font-mono text-yellow-700 dark:text-yellow-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold text-gray-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text, className = '' }) {
  const blocks = useMemo(() => {
    const src = String(text ?? '');
    const lines = src.split('\n');
    const out = [];
    let list = null; // { ordered: bool, items: [] }

    const flushList = () => {
      if (list) {
        const Tag = list.ordered ? 'ol' : 'ul';
        out.push({
          type: 'list',
          ordered: list.ordered,
          items: list.items,
          Tag,
        });
        list = null;
      }
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        flushList();
        continue;
      }
      const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ulMatch) {
        if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
        list.items.push(ulMatch[1]);
        continue;
      }
      if (olMatch) {
        if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
        list.items.push(olMatch[1]);
        continue;
      }
      flushList();
      out.push({ type: 'p', text: line });
    }
    flushList();
    return out;
  }, [text]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {blocks.map((b, idx) => {
        if (b.type === 'list') {
          const listCls = b.ordered ? 'list-decimal' : 'list-disc';
          const items = b.items.map((it, i) => (
            <li key={i} className="leading-relaxed pl-0.5">
              {renderInline(it, `l${idx}-${i}`)}
            </li>
          ));
          return b.Tag === 'ol' ? (
            <ol key={idx} className={`${listCls} pl-5 space-y-1 marker:text-yellow-500`}>{items}</ol>
          ) : (
            <ul key={idx} className={`${listCls} pl-5 space-y-1 marker:text-yellow-500`}>{items}</ul>
          );
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(b.text, `p${idx}`)}
          </p>
        );
      })}
    </div>
  );
}
