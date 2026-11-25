'use client';

import React from 'react';

interface GeminiMarkdownProps {
  text: string;
  isUser?: boolean;
  isStreaming?: boolean;
  className?: string;
}

function renderInline(line: string, isUser: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, `code`, or *italic*
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong
          key={`b-${key++}`}
          className={`font-bold ${isUser ? 'text-white' : 'text-slate-900'}`}
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className={`px-1.5 py-0.5 rounded-md font-mono text-[0.9em] ${
            isUser
              ? 'bg-white/20 text-white'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }
  return nodes;
}

export default function GeminiMarkdown({
  text,
  isUser = false,
  isStreaming = false,
  className = '',
}: GeminiMarkdownProps) {
  const raw = text || '';
  // Split code blocks first
  const segments = raw.split(/(```[\s\S]*?```)/g);

  const cursor = isStreaming ? (
    <span className="inline-block w-1.5 h-3.5 bg-gradient-to-b from-emerald-500 to-teal-400 rounded-sm animate-pulse ml-1 align-middle" />
  ) : null;

  return (
    <div className={`space-y-1.5 leading-relaxed break-words overflow-x-hidden min-w-0 ${className}`}>
      {segments.map((segment, segIdx) => {
        const isLastSegment = segIdx === segments.length - 1;
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const codeBody = segment.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
          return (
            <pre
              key={`pre-${segIdx}`}
              className={`rounded-xl p-2.5 overflow-x-auto text-[11px] font-mono ${
                isUser
                  ? 'bg-black/25 text-white'
                  : 'bg-slate-900 text-emerald-100 border border-slate-800'
              }`}
            >
              <code>{codeBody}</code>
            </pre>
          );
        }

        const lines = segment.split('\n');
        return (
          <React.Fragment key={`seg-${segIdx}`}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              const showCursor = isLastSegment && lineIdx === lines.length - 1 ? cursor : null;

              if (!trimmed) {
                return <div key={`sp-${lineIdx}`} className="h-1" />;
              }

              // Horizontal rule
              if (/^---+$/.test(trimmed)) {
                return (
                  <hr
                    key={`hr-${lineIdx}`}
                    className={isUser ? 'border-white/25 my-1.5' : 'border-slate-200 my-1.5'}
                  />
                );
              }

              // Headings (#, ##, ###)
              const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const content = headingMatch[2];
                const sizeCls =
                  level === 1 ? 'text-sm font-extrabold' : level === 2 ? 'text-[13px] font-bold' : 'text-xs font-bold';
                return (
                  <div
                    key={`h-${lineIdx}`}
                    className={`${sizeCls} pt-1 ${isUser ? 'text-white' : 'text-emerald-900'}`}
                  >
                    {renderInline(content, isUser)}
                    {showCursor}
                  </div>
                );
              }

              // Blockquote (> ...)
              if (trimmed.startsWith('> ')) {
                return (
                  <div
                    key={`bq-${lineIdx}`}
                    className={`border-l-2 pl-2.5 py-0.5 italic ${
                      isUser ? 'border-white/60 text-white/95' : 'border-emerald-500 text-slate-700 bg-emerald-50/40 rounded-r-lg'
                    }`}
                  >
                    {renderInline(trimmed.slice(2), isUser)}
                    {showCursor}
                  </div>
                );
              }

              // Bullet list (- or * or •)
              const bulletMatch = line.match(/^\s*([-*•])\s+(.+)$/);
              if (bulletMatch) {
                return (
                  <div key={`ul-${lineIdx}`} className="flex items-start gap-2 pl-1">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        isUser ? 'bg-emerald-200' : 'bg-emerald-600'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      {renderInline(bulletMatch[2], isUser)}
                      {showCursor}
                    </div>
                  </div>
                );
              }

              // Numbered list (1. 2. ...)
              const numMatch = line.match(/^\s*(\d+\.)\s+(.+)$/);
              if (numMatch) {
                return (
                  <div key={`ol-${lineIdx}`} className="flex items-start gap-1.5 pl-0.5">
                    <span
                      className={`font-bold shrink-0 ${
                        isUser ? 'text-emerald-200' : 'text-emerald-700'
                      }`}
                    >
                      {numMatch[1]}
                    </span>
                    <div className="flex-1 min-w-0">
                      {renderInline(numMatch[2], isUser)}
                      {showCursor}
                    </div>
                  </div>
                );
              }

              // Normal paragraph line
              return (
                <p key={`p-${lineIdx}`}>
                  {renderInline(line, isUser)}
                  {showCursor}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
