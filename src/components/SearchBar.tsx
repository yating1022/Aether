import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { EngineId } from '../types/nav';
import { ENGINE_ORDER, ENGINES } from '../lib/engines';

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  engine: EngineId;
  onEngineChange: (engine: EngineId) => void;
  onSearchWeb: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchBar({
  query,
  onQueryChange,
  engine,
  onEngineChange,
  onSearchWeb,
  inputRef,
}: SearchBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const active = ENGINES[engine];

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="hero">
      <div className="search" ref={wrapRef}>
        <button
          type="button"
          className="engine-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          title="切换搜索引擎"
        >
          <Search size={14} strokeWidth={2.4} style={{ color: 'var(--brand)' }} />
          {active.label}
          <ChevronDown size={11} strokeWidth={2.4} style={{ color: 'var(--text-secondary)' }} />
        </button>

        {menuOpen ? (
          <div className="engine-menu" role="listbox">
            {ENGINE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={id === engine}
                className="engine-option"
                data-active={id === engine}
                onClick={() => {
                  onEngineChange(id);
                  setMenuOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {ENGINES[id].label}
                {id === engine ? <span>·</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.trim()) {
              event.preventDefault();
              onSearchWeb(query.trim());
            }
            if (event.key === 'Escape') {
              onQueryChange('');
              event.currentTarget.blur();
            }
          }}
          placeholder="搜索书签、域名，或直接按 Enter 跳转搜索引擎..."
          aria-label="搜索书签或网页"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="kbd-row">
          <span className="kbd">⌘K</span>
          <span className="kbd">↵</span>
        </div>
      </div>

      <div className="chips">
        <span className="chip" data-active={true} aria-hidden="true">
          站内实时过滤
        </span>
        {ENGINE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="chip"
            data-active={false}
            onClick={() => onEngineChange(id)}
            title={`使用 ${ENGINES[id].label} 搜索`}
          >
            {ENGINES[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
