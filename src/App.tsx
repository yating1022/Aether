import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import {
  createCategory,
  createLink,
  deleteCategory as removeCategory,
  deleteLink as removeLink,
  currentUser,
  isLoggedIn,
  loadNav,
  logout as clearSession,
  PB_CONFIG_ERROR,
  PB_URL,
  subscribeAuth,
  updateCategory,
  updateLink,
} from './api/pocketbase';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { CategorySection } from './components/CategorySection';
import { CategoryModal, LinkModal } from './components/ModalForm';
import { LoginDialog } from './components/LoginDialog';
import { ENGINES } from './lib/engines';
import type {
  AuthUser,
  CategoryWithLinks,
  EngineId,
  LinkDraft,
  LinkItem,
  Theme,
} from './types/nav';

type ToastKind = 'error' | 'success';

interface ToastState {
  message: string;
  kind: ToastKind;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'aether.theme';
const ENGINE_STORAGE_KEY = 'aether.engine';

function readInitialTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readInitialEngine(): EngineId {
  const stored = window.localStorage.getItem(ENGINE_STORAGE_KEY);
  if (stored === 'google' || stored === 'bing' || stored === 'baidu' || stored === 'github') {
    return stored;
  }
  return 'google';
}

export default function App() {
  const [categories, setCategories] = useState<CategoryWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [engine, setEngine] = useState<EngineId>(readInitialEngine);
  const [manageMode, setManageMode] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => currentUser());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');

  const [loginOpen, setLoginOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<{ editing: LinkItem | null; categoryId: string } | null>(
    null,
  );
  const [categoryModal, setCategoryModal] = useState<{ editing: CategoryWithLinks | null } | null>(
    null,
  );
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind });
  }, []);

  const load = useCallback(async () => {
    if (PB_CONFIG_ERROR) {
      setLoadError(PB_CONFIG_ERROR);
      setLoading(false);
      return;
    }
    try {
      const data = await loadNav();
      setCategories(data);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '加载导航数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep UI in sync with PocketBase auth-store changes (login, logout, expiry).
  useEffect(() => {
    const unsubscribe = subscribeAuth(() => {
      setUser(currentUser());
      if (!isLoggedIn()) setManageMode(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(ENGINE_STORAGE_KEY, engine);
  }, [engine]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // "/" or Cmd/Ctrl+K focuses search, but never while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isTyping =
        tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const totalLinks = useMemo(
    () => categories.reduce((sum, category) => sum + category.links.length, 0),
    [categories],
  );

  const visibleCategories = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return categories
      .filter((category) => activeCategory === 'all' || category.id === activeCategory)
      .map((category) => {
        if (!keyword) return category;
        return {
          ...category,
          links: category.links.filter((link) =>
            [link.title, link.description, link.url]
              .filter(Boolean)
              .some((field) => field.toLowerCase().includes(keyword)),
          ),
        };
      })
      .filter((category) => (keyword ? category.links.length > 0 : true));
  }, [categories, query, activeCategory]);

  const visibleCount = useMemo(
    () => visibleCategories.reduce((sum, category) => sum + category.links.length, 0),
    [visibleCategories],
  );

  /* ------------------------------ actions ------------------------------ */

  const handleSearchWeb = (value: string) => {
    const target = ENGINES[engine].buildUrl(value);
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const handleToggleManage = () => {
    if (PB_CONFIG_ERROR) {
      notify(PB_CONFIG_ERROR, 'error');
      return;
    }
    if (manageMode) {
      setManageMode(false);
      return;
    }
    if (!isLoggedIn()) {
      setLoginOpen(true);
      return;
    }
    setQuery('');
    setManageMode(true);
  };

  const handleLoginSuccess = (loggedIn: AuthUser) => {
    setUser(loggedIn);
    setQuery('');
    setManageMode(true);
    notify(`已登录：${loggedIn.email}`);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setManageMode(false);
    notify('已退出登录');
  };

  const handleSubmitLink = async (draft: LinkDraft, icon: Blob | null) => {
    if (linkModal?.editing) {
      await updateLink(linkModal.editing.id, draft, icon);
      notify('书签已更新');
    } else {
      await createLink(draft, icon);
      notify('书签已添加');
    }
    await load();
    if (activeCategory !== 'all' && draft.category_id !== activeCategory) {
      setActiveCategory('all');
    }
  };

  const handleDeleteLink = (link: LinkItem) => {
    setConfirmState({
      title: `删除「${link.title}」？`,
      message: '该网址将从 PocketBase 中永久移除，此操作不可撤销。',
      confirmLabel: '删除网址',
      action: async () => {
        await removeLink(link.id);
        await load();
        notify('书签已删除');
      },
    });
  };

  const handleSubmitCategory = async (name: string) => {
    if (categoryModal?.editing) {
      await updateCategory(categoryModal.editing.id, name);
      notify('分类已重命名');
    } else {
      await createCategory(name);
      notify('分类已创建');
    }
    await load();
  };

  const handleDeleteCategory = (category: CategoryWithLinks) => {
    setConfirmState({
      title: `删除分类「${category.name}」？`,
      message: `该分类下的 ${category.links.length} 个网址会一并被移除（PocketBase 级联删除），此操作不可撤销。`,
      confirmLabel: '删除分类',
      action: async () => {
        await removeCategory(category.id);
        if (activeCategory === category.id) setActiveCategory('all');
        await load();
        notify('分类已删除');
      },
    });
  };

  const runConfirm = async () => {
    if (!confirmState) return;
    const { action } = confirmState;
    setConfirmState(null);
    try {
      await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败', 'error');
    }
  };

  /* ------------------------------- render ------------------------------ */

  const showEmpty = !loading && visibleCategories.length === 0;

  return (
    <div className="app">
      <div className="shell">
        <Header
          categories={categories}
          totalLinks={totalLinks}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          manageMode={manageMode}
          onToggleManage={handleToggleManage}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onCreateCategory={() => setCategoryModal({ editing: null })}
          editorEmail={user?.email ?? null}
          onLogout={handleLogout}
        />

        {!manageMode ? (
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            engine={engine}
            onEngineChange={setEngine}
            onSearchWeb={handleSearchWeb}
            inputRef={searchRef}
          />
        ) : (
          <div className="hero" style={{ padding: '26px 0 22px' }}>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>正在编排索引 · 共 {totalLinks} 个站点 · 点击「完成」返回浏览模式</span>
            </div>
          </div>
        )}

        {loadError ? (
          <div className="empty">
            <div className="empty-title">
              {PB_CONFIG_ERROR ? '尚未配置 PocketBase 地址' : '无法读取 PocketBase 数据'}
            </div>
            <div className="empty-text">{loadError}</div>
            {PB_CONFIG_ERROR ? (
              <div className="empty-text" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                VITE_PB_URL={PB_URL || 'http://<your-pocketbase-host>'}
              </div>
            ) : (
              <button type="button" className="btn btn-outline" onClick={() => void load()}>
                重新加载
              </button>
            )}
          </div>
        ) : null}

        {loading ? (
          <div className="empty">
            <Loader2 size={18} className="spin" style={{ color: 'var(--brand)' }} />
            <div className="empty-text">正在从 PocketBase 读取索引...</div>
          </div>
        ) : null}

        {!loading && !loadError ? (
          visibleCategories.length > 0 ? (
            <div className="trays">
              {visibleCategories.map((category, index) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  categoryIndex={index}
                  manageMode={manageMode}
                  onAddLink={(categoryId) => setLinkModal({ editing: null, categoryId })}
                  onEditLink={(link) => setLinkModal({ editing: link, categoryId: link.category_id })}
                  onDeleteLink={handleDeleteLink}
                  onRenameCategory={(target) => setCategoryModal({ editing: target })}
                  onDeleteCategory={handleDeleteCategory}
                />
              ))}
            </div>
          ) : showEmpty ? (
            <div className="empty">
              <div className="empty-title">
                {query.trim()
                  ? '没有匹配的书签'
                  : categories.length === 0
                    ? '还没有任何分类'
                    : '该分类下暂无网址'}
              </div>
              <div className="empty-text">
                {query.trim()
                  ? `没有找到与「${query.trim()}」相关的书签，按 Enter 可用 ${ENGINES[engine].label} 搜索网页。`
                  : '登录编辑者账号后即可创建分类并添加第一个网址，数据会保存到 PocketBase。'}
              </div>
              {!query.trim() && categories.length === 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (!isLoggedIn()) setLoginOpen(true);
                    else setCategoryModal({ editing: null });
                  }}
                >
                  <Plus size={13} strokeWidth={2.4} />
                  新建第一个分类
                </button>
              ) : null}
            </div>
          ) : null
        ) : null}

        <footer className="footer">
          <span>
            按 <kbd>/</kbd> 聚焦搜索 · 按 <kbd>Enter</kbd> 使用 {ENGINES[engine].label} 检索网页 · 点击卡片在新标签页打开
          </span>
          <span>·</span>
          <span>数据存储于 PocketBase · 共 {visibleCount} 个可见站点</span>
        </footer>
      </div>

      {loginOpen ? (
        <LoginDialog
          onClose={() => setLoginOpen(false)}
          onSuccess={handleLoginSuccess}
        />
      ) : null}

      {linkModal ? (
        <LinkModal
          categories={categories}
          editing={linkModal.editing}
          defaultCategoryId={linkModal.categoryId}
          onClose={() => setLinkModal(null)}
          onSubmit={handleSubmitLink}
        />
      ) : null}

      {categoryModal ? (
        <CategoryModal
          editing={categoryModal.editing}
          onClose={() => setCategoryModal(null)}
          onSubmit={handleSubmitCategory}
        />
      ) : null}

      {confirmState ? (
        <ConfirmDialog
          state={confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => void runConfirm()}
        />
      ) : null}

      {toast ? (
        <div className="toast" data-kind={toast.kind} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

interface ConfirmDialogProps {
  state: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ state, onCancel, onConfirm }: ConfirmDialogProps) {
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="dialog narrow" role="dialog" aria-modal="true" aria-label={state.title}>
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{state.title}</h2>
            <p className="dialog-sub">{state.message}</p>
          </div>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-soft" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
