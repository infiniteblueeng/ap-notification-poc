import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import Handlebars from 'handlebars';
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
  partial?: {
    context?: string;
    arguments?: Array<{
      key?: string;
      defaultValue?: {
        value?: unknown;
      };
    }>;
  };
};

type PreviewMessagesProps = {
  contents: MessageContent[];
  variables: VariableDef[];
  valuesById: Record<string, string | string[] | null | undefined>;
  defaultOpen?: Record<string, boolean>;
  getChannelLabel?: (c: MessageContent) => string;
  showPreviewHeader?: boolean;
};

type PreviewValue = string | string[] | null | undefined;

type PreviewValueWrapper = {
  __previewValue: PreviewValue;
  toString: () => string;
  valueOf: () => string;
};

type PreviewTemplateContext = {
  custom: Record<string, PreviewValueWrapper>;
  system: {
    variableMetadata: {
      custom: Record<string, VariableDef>;
    };
  };
  [key: string]: unknown;
};

const previewHandlebars = Handlebars.create();

function toDisplayValue(v: unknown) {
  const value = unwrapPreviewValue(v);

  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
}

function unwrapPreviewValue(value: unknown): unknown {
  if (value && typeof value === 'object' && '__previewValue' in value) {
    return (value as PreviewValueWrapper).__previewValue;
  }

  return value;
}

function toSafeDisplayValue(value: unknown) {
  return new previewHandlebars.SafeString(toDisplayValue(value));
}

previewHandlebars.registerHelper('formatPreviewValue', (value: unknown) => toSafeDisplayValue(value));
previewHandlebars.registerHelper('printList', (value: unknown) => toSafeDisplayValue(value));
previewHandlebars.registerPartial('renderVariable', '{{formatPreviewValue this}}');

function createPreviewValue(value: PreviewValue): PreviewValueWrapper {
  return {
    __previewValue: value,
    toString() {
      return toDisplayValue(this);
    },
    valueOf() {
      return toDisplayValue(this);
    },
  };
}

function customKeyFromPath(path: unknown) {
  const value = typeof path === 'string' ? path.trim() : '';
  const bracketPrefix = 'custom.[';
  const dotPrefix = 'custom.';

  if (value.startsWith(bracketPrefix) && value.endsWith(']')) {
    return value.slice(bracketPrefix.length, -1);
  }

  if (value.startsWith(dotPrefix)) {
    return value.slice(dotPrefix.length);
  }

  return value;
}

function customMetadataKeyFromPath(path: unknown) {
  const value = typeof path === 'string' ? path.trim() : '';
  const prefix = 'system.variableMetadata.';

  return value.startsWith(prefix) ? customKeyFromPath(value.slice(prefix.length)) : customKeyFromPath(value);
}

function findVariableMetadataPath(v: VariableDef) {
  return v.partial?.arguments?.find((arg) => String(arg?.key ?? '').toLowerCase() === 'variablemetadata')?.defaultValue?.value;
}

function firstDefinedValue(valuesById: PreviewMessagesProps['valuesById'], keys: string[]) {
  for (const key of keys) {
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(valuesById, key)) {
      return valuesById[key] ?? null;
    }
  }

  return null;
}

function addCustomValue(context: PreviewTemplateContext, key: string, value: PreviewValue, variable: VariableDef, wrappedValue: PreviewValueWrapper) {
  if (!key) return;

  context.custom[key] = wrappedValue;
  context.system.variableMetadata.custom[key] = variable;
}

function buildTemplateContext(variables: VariableDef[], valuesById: PreviewMessagesProps['valuesById']): PreviewTemplateContext {
  const context: PreviewTemplateContext = {
    custom: {},
    system: {
      variableMetadata: {
        custom: {},
      },
    },
  };

  for (const v of variables) {
    const partialContextKey = customKeyFromPath(v.partial?.context);
    const metadataKey = customMetadataKeyFromPath(findVariableMetadataPath(v));
    const lookupKeys = [v.id, v.uniqueKey, v.token, v.name, v.partial?.context ?? '', partialContextKey, metadataKey];
    const value = firstDefinedValue(valuesById, lookupKeys);
    const wrappedValue = createPreviewValue(value);
    const customKeys = [v.name, v.token, v.uniqueKey, v.id, partialContextKey, metadataKey];

    for (const key of customKeys) {
      addCustomValue(context, key, value, v, wrappedValue);
    }

    context[v.id] = wrappedValue;
    context[v.uniqueKey] = wrappedValue;
    context[v.token] = wrappedValue;
    context[v.name] = wrappedValue;
  }

  return context;
}

function renderTemplate(raw: string, context: PreviewTemplateContext) {
  if (!raw) return '';

  try {
    return previewHandlebars.compile(raw)(context);
  } catch (error) {
    console.error('Error rendering Handlebars preview template:', error);
    return raw;
  }
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

  const templateContext = useMemo(() => buildTemplateContext(variables ?? [], valuesById ?? {}), [variables, valuesById]);

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
                  const interpolated = renderTemplate(c.content ?? '', templateContext);
                  const rawTitle = c.title?.trim();
                  const title = rawTitle ? renderTemplate(rawTitle, templateContext) : '';
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
