import { Pencil, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function placeCaretAtEnd(el: HTMLElement) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch {}
}

export default function LaunchHeader({
  title,
  onSaveTitle, // (nextTitle: string) => void
  description,
  onSaveDescription, // (nextDescription: string) => void
}: any) {
  // title editing state lives here
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [titleOriginalAtEditStart, setTitleOriginalAtEditStart] = useState<string | null>(null);
  const titleEditableRef = useRef<HTMLDivElement | null>(null);

  // description editing state lives here
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState(description);
  const descTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // keep drafts in sync when not actively editing
  useEffect(() => {
    if (!editingTitle) setTitleDraft(title);
  }, [title, editingTitle]);

  useEffect(() => {
    if (!editingDescription) setDescDraft(description);
  }, [description, editingDescription]);

  // focus title edit + caret
  useEffect(() => {
    if (editingTitle && titleEditableRef.current) {
      titleEditableRef.current.textContent = titleDraft ?? '';
      titleEditableRef.current.focus();
      placeCaretAtEnd(titleEditableRef.current);
    }
  }, [editingTitle, titleDraft]);

  // focus description edit
  useEffect(() => {
    if (editingDescription && descTextareaRef.current) {
      descTextareaRef.current.focus();
      const len = descTextareaRef.current.value.length;
      descTextareaRef.current.setSelectionRange(len, len);
    }
  }, [editingDescription]);

  function startEditTitle() {
    setTitleOriginalAtEditStart(title);
    setTitleDraft(title);
    setEditingTitle(true);
  }

  function cancelEditTitle() {
    setEditingTitle(false);
    setTitleDraft(title);
    setTitleOriginalAtEditStart(null);
    if (titleEditableRef.current) titleEditableRef.current.textContent = title;
  }

  function resetEditTitle() {
    if (titleOriginalAtEditStart != null) {
      setTitleDraft(titleOriginalAtEditStart);
      if (titleEditableRef.current) {
        titleEditableRef.current.textContent = titleOriginalAtEditStart;
        requestAnimationFrame(() => placeCaretAtEnd(titleEditableRef.current!));
      }
    }
  }

  function commitTitle(nextFromDom?: string) {
    const next = (nextFromDom ?? titleDraft ?? '').trim();
    if (next) onSaveTitle(next);
    setEditingTitle(false);
    setTitleOriginalAtEditStart(null);
  }

  function onTitleInput() {
    const txt = titleEditableRef.current?.textContent ?? '';
    setTitleDraft(txt);
  }

  function onTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle(titleEditableRef.current?.textContent ?? '');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditTitle();
    }
  }

  function startEditDescription() {
    setDescDraft(description);
    setEditingDescription(true);
  }

  function cancelEditDescription() {
    setEditingDescription(false);
    setDescDraft(description);
  }

  function commitDescription() {
    onSaveDescription(descDraft ?? '');
    setEditingDescription(false);
  }

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <>
                <div
                  ref={titleEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={onTitleInput}
                  onKeyDown={onTitleKeyDown}
                  role="textbox"
                  aria-label="Edit title"
                  className="text-3xl font-normal leading-tight rounded-md focus:outline-none py-0"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitTitle(titleEditableRef.current?.textContent ?? '')}
                  aria-label="Save title"
                  title="Save title"
                  className="rounded p-1">
                  <Save className="w-4 h-4 text-zinc-700" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={resetEditTitle} aria-label="Reset title" title="Reset title" className="rounded p-1">
                  <RotateCcw className="w-4 h-4 text-zinc-700" />
                </button>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-normal leading-tight">{title}</h1>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={startEditTitle} aria-label="Edit title" title="Edit title" className="rounded p-1">
                  <Pencil className="w-4 h-4 text-zinc-700" />
                </button>
              </>
            )}
          </div>

          <div className="mt-2">
            {editingDescription ? (
              <textarea
                placeholder="Enter a communication description"
                ref={descTextareaRef}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={commitDescription}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    commitDescription();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditDescription();
                  }
                }}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-vertical"
                rows={2}
              />
            ) : (
              <p className="text-sm text-zinc-600 cursor-text" onClick={startEditDescription} title="Click to edit description">
                {description || 'Enter a communication description'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
