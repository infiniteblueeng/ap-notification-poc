import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import Card from 'components/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';

type MessageContent = {
  type: string;
  title?: string;
  contentType?: string; // "text/plain" | "text/html"
  content?: string;
  paths?: string[];
};

type VariableDef = {
  id: string;
  name: string;
  token: string;
  uniqueKey: string;
  variableType?: string;
};

type PreviewMessagesProps = {
  contents: MessageContent[];
  variables: VariableDef[];
  valuesById: Record<string, string | string[] | null | undefined>;
  defaultOpen?: Record<string, boolean>;
  getChannelLabel?: (c: MessageContent) => string;
  showPreviewHeader?: boolean;
};

function normalizeKey(s: string) {
  return (s ?? '').trim().toLowerCase();
}

function toDisplayValue(v: string | string[] | null | undefined) {
  if (v == null) return '';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

function stripVariableMetadataPrefix(value: string) {
  return value.replace(/^system\.variableMetadata\./i, '');
}

function buildValueIndex(variables: VariableDef[], valuesById: PreviewMessagesProps['valuesById']) {
  const byKey = new Map<string, string | string[] | null>();

  for (const v of variables) {
    const partialContext = (v as any)?.partial?.context ? String((v as any).partial.context) : '';
    const metadataPath = (v as any)?.partial?.arguments?.find?.((arg: any) => String(arg?.key ?? '').toLowerCase() === 'variablemetadata')?.defaultValue?.value;
    const metadataKey = metadataPath ? stripVariableMetadataPrefix(String(metadataPath)) : '';

    const value = valuesById[v.id] ?? valuesById[v.uniqueKey] ?? valuesById[partialContext] ?? valuesById[v.token] ?? valuesById[v.name] ?? null;

    const keys = [v.id, v.name, v.token, v.uniqueKey, partialContext, metadataKey, `custom.[${v.name}]`, `custom.[${v.token}]`, `custom.${v.token}`, `custom.${v.name}`];

    for (const k of keys) {
      const nk = normalizeKey(k);
      if (nk) byKey.set(nk, value);
    }
  }

  return { byKey };
}

function getIndexedValue(valueIndex: { byKey: Map<string, any> }, keyRaw: string) {
  const key = keyRaw.trim();
  return valueIndex.byKey.get(normalizeKey(key)) ?? valueIndex.byKey.get(normalizeKey(stripVariableMetadataPrefix(key)));
}

function extractRenderVariableKey(expr: string) {
  const match = expr.match(/^>?\s*renderVariable\s+(.+)$/i);
  if (!match) return null;

  const rest = match[1].trim();
  if (!rest) return null;

  const quoted = rest.match(/^(['"])(.*?)\1/);
  if (quoted) return quoted[2].trim();

  if (/^custom\.\[/i.test(rest)) {
    const closeIndex = rest.indexOf(']');
    return closeIndex >= 0 ? rest.slice(0, closeIndex + 1).trim() : rest;
  }

  return rest.split(/\s+/)[0].trim();
}

function resolveTemplateExpression(expr: string, valueIndex: { byKey: Map<string, any> }) {
  const clean = String(expr ?? '').trim();
  if (!clean) return '';

  const renderVariableKey = extractRenderVariableKey(clean);
  if (renderVariableKey) {
    return toDisplayValue(getIndexedValue(valueIndex, renderVariableKey));
  }

  const printListMatch = clean.match(/^printList\s+(.+)$/i);
  if (printListMatch) {
    return toDisplayValue(getIndexedValue(valueIndex, printListMatch[1]));
  }

  if (!/\s/.test(clean) || /^custom\.\[.*\]$/i.test(clean)) {
    return toDisplayValue(getIndexedValue(valueIndex, clean));
  }

  return null;
}

function interpolateTemplate(raw: string, valueIndex: { byKey: Map<string, any> }) {
  if (!raw) return '';

  return raw.replace(/\{\{\{\s*([\s\S]+?)\s*\}\}\}|\{\{\s*([\s\S]+?)\s*\}\}/g, (match, tripleInner, doubleInner) => {
    const resolved = resolveTemplateExpression(tripleInner ?? doubleInner, valueIndex);
    return resolved == null ? match : resolved;
  });
}

function defaultGetChannelLabel(c: MessageContent) {
  const p = (c.paths ?? []).join('|').toLowerCase();
  if (p.includes('sms')) return 'SMS';
  if (p.includes('voice')) return 'Voice';
  return 'Email';
}

function isHtmlContentType(contentType?: string) {
  return (contentType ?? '').toLowerCase().includes('text/html');
}

export function PreviewMessages({ contents, variables, valuesById, defaultOpen, getChannelLabel = defaultGetChannelLabel, showPreviewHeader = true }: PreviewMessagesProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(defaultOpen ?? { Email: true, SMS: false, Voice: false });

  const valueIndex = useMemo(() => buildValueIndex(variables ?? [], valuesById ?? {}), [variables, valuesById]);

  const grouped = useMemo(() => {
    const map = new Map<string, MessageContent[]>();
    for (const c of contents ?? []) {
      const label = getChannelLabel(c);
      map.set(label, [...(map.get(label) ?? []), c]);
    }
    return map;
  }, [contents, getChannelLabel]);

  if (!contents?.length) return null;

  return (
    <div className={`${showPreviewHeader ? 'p-6' : 'px-6 py-2'}`}>
      {showPreviewHeader && <div className="text-[22px] font-medium text-[#13151C] mb-2">Preview the Message</div>}

      {Array.from(grouped.entries()).map(([label, items]) => {
        const isOpen = Boolean(open[label]);

        return (
          <div key={label} className="py-1.5">
            {/* Whole header row is clickable */}
            <button type="button" className="w-full flex items-center gap-2 text-left py-2 rounded-md hover:bg-zinc-50" onClick={() => setOpen((s) => ({ ...s, [label]: !s[label] }))}>
              {/* Chevron on the LEFT */}
              <span className="text-zinc-500">{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>

              <span className="font-medium text-zinc-900">{label}</span>
            </button>

            {isOpen ? (
              <div className="mt-1.5 space-y-4">
                {items.map((c, idx) => {
                  const interpolated = interpolateTemplate(c.content ?? '', valueIndex);
                  const rawTitle = c.title?.trim();
                  const title = rawTitle ? interpolateTemplate(rawTitle, valueIndex) : '';
                  const html = isHtmlContentType(c.contentType);

                  const safeHtml = html ? DOMPurify.sanitize(interpolated) : '';

                  return (
                    // No grey background; keep spacing/padding similar
                    <div key={idx} className="rounded-xl px-4 py-2">
                      {title ? <div className="text-sm font-semibold text-zinc-900 mb-2">Subject: {title}</div> : null}

                      {html ? (
                        <>
                          <span className="text-sm text-zinc-800 prose prose-sm max-w-none">Message:</span>
                          <div className="text-sm text-zinc-800 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
                        </>
                      ) : (
                        <div className="text-sm text-zinc-800 whitespace-pre-wrap">Message: {interpolated || <span className="text-zinc-400">No content</span>}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
