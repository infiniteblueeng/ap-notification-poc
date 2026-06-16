import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, Triangle } from 'lucide-react';
import { getPortalContainer } from 'domScope';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
};

function optionFromChild(child: any) {
  if (!child) return null;
  const { props } = child;
  const value = props?.value ?? (typeof child === 'string' ? child : '');
  const label = props?.children != null ? (typeof props.children === 'string' ? props.children : String(props.children)) : String(value);
  const disabled = !!props?.disabled;
  return { value: String(value), label, disabled };
}

export function Select({ children, isLoading, loadingText = 'Loading…', className = '', value, onChange, disabled, ...props }: SelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => {
    const arr: Array<{ value: string; label: string; disabled?: boolean }> = [];
    React.Children.forEach(children, (child) => {
      const opt = optionFromChild(child);
      if (opt) arr.push(opt);
    });
    return arr;
  }, [children]);

  const selectedValue = String(value ?? '');
  const selectedOption = options.find((o) => o.value === selectedValue) ?? null;
  const placeholderOption = options.find((o) => o.value === '') ?? null;

  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const computeMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  const isFocusInside = useCallback((target: EventTarget | null) => {
    const node = target as Node | null;
    if (!node) return false;

    return !!((containerRef.current && containerRef.current.contains(node)) || (menuRef.current && menuRef.current.contains(node)));
  }, []);

  const isEventInside = useCallback(
    (event: Event) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];

      if (path.length > 0) {
        return !![containerRef.current, menuRef.current].find((node) => node && path.includes(node));
      }

      return isFocusInside(event.target);
    },
    [isFocusInside]
  );

  useEffect(() => {
    if (open) {
      computeMenuPosition();
      requestAnimationFrame(() => {
        menuRef.current?.focus();
      });
    }
  }, [open, computeMenuPosition]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!open) return;
      if (isEventInside(e)) return;
      setOpen(false);
    }

    function onFocusIn(e: FocusEvent) {
      if (!open) return;
      if (isEventInside(e)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', computeMenuPosition);
    window.addEventListener('scroll', computeMenuPosition, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', computeMenuPosition);
      window.removeEventListener('scroll', computeMenuPosition, true);
    };
  }, [open, computeMenuPosition, isEventInside]);

  useEffect(() => {
    if (!open) {
      setHighlightIndex(null);
      return;
    }

    const idx = options.findIndex((o) => o.value === selectedValue && !o.disabled);
    setHighlightIndex(idx >= 0 ? idx : options.findIndex((o) => !o.disabled));
  }, [open, options, selectedValue]);

  function triggerOnChange(nextValue: string) {
    if (typeof onChange === 'function') {
      onChange({ target: { value: nextValue } } as unknown as any);
    }
  }

  const handleToggle = () => {
    if (disabled) return;
    setOpen((s) => !s);
  };

  const handleOptionClick = (opt: { value: string; label: string; disabled?: boolean }) => {
    if (opt.disabled) return;
    triggerOnChange(opt.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      setHighlightIndex((cur) => {
        const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
        if (!enabled.length) return null;

        const indices = enabled.map((x) => x.i);
        if (cur == null) return indices[0];

        const pos = indices.indexOf(cur);
        if (e.key === 'ArrowDown') {
          return indices[(pos + 1) % indices.length];
        } else {
          return indices[(pos - 1 + indices.length) % indices.length];
        }
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((s) => !s);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();

      setHighlightIndex((cur) => {
        const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
        if (!enabled.length) return null;

        const indices = enabled.map((x) => x.i);
        if (cur == null) return indices[0];

        const pos = indices.indexOf(cur);
        if (e.key === 'ArrowDown') {
          return indices[(pos + 1) % indices.length];
        } else {
          return indices[(pos - 1 + indices.length) % indices.length];
        }
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex != null) {
        const opt = options[highlightIndex];
        if (!opt?.disabled) {
          handleOptionClick(opt);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const caretClass = open ? 'rotate-0 transform-gpu' : 'rotate-180 transform-gpu';
  const displayLabel = selectedOption ? selectedOption.label : placeholderOption ? placeholderOption.label : '';

  const controlBase = 'w-full rounded bg-white border px-3 py-2.5 text-lg text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-zinc-50 disabled:text-zinc-400';

  return (
    <div ref={containerRef} className={`relative ${className}`} {...(props as any)}>
      {isLoading ? (
        <div aria-busy="true" className={[controlBase, 'flex items-center gap-2 cursor-not-allowed select-none', 'border !border-[#76A5FF] text-zinc-500'].join(' ')}>
          <RotateCw className="animate-spin" color="#405172" size={14} />
          <span className="text-sm font-normal text-[#405172]">{loadingText}</span>
        </div>
      ) : (
        <>
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
            onClick={handleToggle}
            onKeyDown={handleButtonKeyDown}
            className={[controlBase, 'flex items-center justify-between', disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer', 'border !border-[#76A5FF]'].join(' ')}>
            <span className={`text-base text-[#405172] font-normal truncate text-left ${selectedOption ? '' : 'text-zinc-400'}`}>{displayLabel}</span>

            <div className={`inline-block transition-transform duration-150 ${caretClass}`}>
              <Triangle size={6} fill="#405172" />
            </div>
          </button>

          {open &&
            createPortal(
              <div
                ref={menuRef}
                role="listbox"
                aria-activedescendant={highlightIndex != null ? `select-opt-${highlightIndex}` : undefined}
                tabIndex={-1}
                onKeyDown={handleMenuKeyDown}
                style={menuStyle}>
                <div className="bg-white rounded shadow-lg ring-1 ring-black ring-opacity-5 text-sm" style={{ maxHeight: 320, overflow: 'auto' }}>
                  {options.map((opt, idx) => {
                    const isHighlighted = highlightIndex === idx;
                    const isSelected = selectedValue === opt.value;

                    return (
                      <div
                        id={`select-opt-${idx}`}
                        key={opt.value + '-' + idx}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isSelected}
                        onClick={() => handleOptionClick(opt)}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={[
                          'px-3 py-2.5 cursor-pointer select-none flex items-center justify-between text-sm',
                          opt.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-100',
                          isHighlighted ? 'bg-zinc-100' : '',
                          isSelected ? 'bg-blue-100 text-black' : '',
                        ].join(' ')}
                        style={{ userSelect: 'none' }}>
                        <span className={opt.disabled ? 'text-sm text-zinc-100' : 'text-sm text-[#405172]'}>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>,
              getPortalContainer()
            )}
        </>
      )}
    </div>
  );
}

export default Select;
