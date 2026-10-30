import { Check, LogOut, Moon, Plus, SlidersHorizontal, Sun } from 'lucide-react';
import type { CategoryWithLinks, Theme } from '../types/nav';

interface HeaderProps {
  categories: CategoryWithLinks[];
  totalLinks: number;
  activeCategory: string | 'all';
  onSelectCategory: (value: string | 'all') => void;
  manageMode: boolean;
  onToggleManage: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onCreateCategory: () => void;
  editorEmail: string | null;
  onLogout: () => void;
}

export function Header({
  categories,
  totalLinks,
  activeCategory,
  onSelectCategory,
  manageMode,
  onToggleManage,
  theme,
  onToggleTheme,
  onCreateCategory,
  editorEmail,
  onLogout,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3.5 20 19.5H4L12 3.5Z"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="brand-name">Aether</span>
        {manageMode ? (
          <span className="status-pill" title={editorEmail ?? ''}>
            <span className="status-dot" />
            {editorEmail ?? '管理模式'}
          </span>
        ) : (
          <span className="pill-workspace">Workspace</span>
        )}
      </div>

      {!manageMode ? (
        <div className="header-center">
          <div className="segmented" role="tablist" aria-label="分类快速筛选">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'all'}
              className="seg-pill"
              data-active={activeCategory === 'all'}
              onClick={() => onSelectCategory('all')}
            >
              全部 ({totalLinks})
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.id}
                className="seg-pill"
                data-active={activeCategory === category.id}
                onClick={() => onSelectCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="header-center" />
      )}

      <div className="header-actions">
        {manageMode ? (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onCreateCategory}
              title="新建分类"
              aria-label="新建分类"
            >
              <Plus size={13} strokeWidth={2.4} />
              <span className="btn-label">新建分类</span>
            </button>
            <button type="button" className="btn btn-primary" onClick={onToggleManage}>
              <Check size={13} strokeWidth={2.4} />
              完成
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={onLogout}
              title="退出登录"
              aria-label="退出登录"
            >
              <LogOut size={14} strokeWidth={2} />
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-soft" onClick={onToggleManage}>
            <SlidersHorizontal size={13} strokeWidth={2} />
            管理
          </button>
        )}

        <button
          type="button"
          className="btn btn-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
        </button>
      </div>
    </header>
  );
}
