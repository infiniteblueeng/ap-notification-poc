import React from 'react';
import { Button } from 'components/ui/button';
import { RefreshCcw } from 'lucide-react';

type Tone = 'zinc' | 'blue' | 'emerald';
type Variant = 'card' | 'light';

type Props = {
  // allow either plain string or a React node (so callers can customize title area)
  title: string | React.ReactNode;
  description?: string;
  children: React.ReactNode;
  tone?: Tone;
  variant?: Variant;

  // new left slot (e.g., Back button)
  left?: React.ReactNode;

  right?: React.ReactNode;

  // accept callbacks that return void or any Promise (keeps callers flexible)
  onRefresh?: () => void | Promise<unknown>;
  refreshing?: boolean;
  refreshLabel?: string;
  refreshDisabled?: boolean;
};

export default function Section({ title, description, children, tone = 'zinc', variant = 'card', left, right, onRefresh, refreshing = false, refreshLabel = 'Refresh', refreshDisabled }: Props) {
  const toneStyles =
    tone === 'blue'
      ? {
          header: 'bg-gradient-to-r from-blue-100/50 to-blue-50/50 border-blue-200/70',
          title: 'text-blue-950',
          desc: 'text-blue-700/80',
          ring: 'ring-blue-100',
          divider: 'border-blue-100',
        }
      : tone === 'emerald'
        ? {
            header: 'bg-gradient-to-r from-emerald-100/50 to-emerald-50/50 border-emerald-200/70',
            title: 'text-emerald-950',
            desc: 'text-emerald-700/80',
            ring: 'ring-emerald-100',
            divider: 'border-emerald-100',
          }
        : {
            header: 'bg-gradient-to-r from-zinc-100/70 to-zinc-50 border-zinc-200/70',
            title: 'text-zinc-900',
            desc: 'text-zinc-600',
            ring: 'ring-zinc-300',
            divider: 'border-zinc-200/60',
          };

  const isLight = variant === 'light';

  const wrapClass = isLight ? 'bg-transparent' : ['rounded-2xl bg-white shadow-sm ring-1', toneStyles.ring].join(' ');

  const headerClass = isLight
    ? ['flex items-center justify-between gap-4', 'px-0 py-2 border-b', toneStyles.divider].join(' ')
    : ['border-b px-5 py-4 rounded-t-2xl flex items-start justify-between gap-4', toneStyles.header].join(' ');

  const bodyClass = isLight ? 'pt-4' : 'p-5';

  // internal click wrapper to normalize sync/async handlers and avoid unhandled promises
  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    try {
      await onRefresh();
    } catch (err) {
      // intentionally swallow - caller can handle errors and toasts
    }
  };

  return (
    <div className={wrapClass}>
      <div className={headerClass}>
        {/* Left + Title area */}
        <div className="flex items-center gap-4 min-w-0">
          {left ? <div className="shrink-0">{left}</div> : null}

          <div className="min-w-0">
            <div className={[isLight ? 'text-base font-semibold' : 'text-lg font-semibold leading-5', toneStyles.title, 'truncate'].join(' ')}>{typeof title === 'string' ? title : title}</div>
            {description ? <div className={['text-xs mt-1', toneStyles.desc, 'truncate'].join(' ')}>{description}</div> : null}
          </div>
        </div>

        {/* Right actions */}
        {right || onRefresh ? (
          <div className="shrink-0 flex items-center gap-2">
            {onRefresh ? (
              <Button variant="secondary" size="sm" onClick={handleRefreshClick} disabled={refreshDisabled}>
                {refreshing ? <RefreshCcw className="animate-spin" /> : <RefreshCcw />}
                {refreshing ? 'Refreshing…' : refreshLabel}
              </Button>
            ) : null}
            {right ? <div>{right}</div> : null}
          </div>
        ) : null}
      </div>

      <div className={bodyClass}>{children}</div>
    </div>
  );
}
