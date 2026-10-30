import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, ChevronDown, Loader2, Upload, Wand2, X } from 'lucide-react';
import type { CategoryWithLinks, LinkDraft, LinkItem } from '../types/nav';
import { ensureProtocol, hueOf, initialOf } from '../lib/format';
import { fetchIcon, hostnameOf } from '../lib/icon';

/* -------------------------------------------------------------------------- */
/* shared bits                                                                */
/* -------------------------------------------------------------------------- */

interface IconPreviewProps {
  title: string;
  url: string;
  iconUrl: string;
}

function IconPreview({ title, url, iconUrl }: IconPreviewProps) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [iconUrl]);

  const style = {
    '--tint-h': String(hueOf(hostnameOf(url) || title)),
  } as CSSProperties;

  return (
    <div className="preview-icon" style={style} data-has-image={Boolean(iconUrl) && loaded && !broken}>
      {iconUrl && !broken ? (
        <img
          src={iconUrl}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="card-monogram">{initialOf(title || '·')}</span>
      )}
    </div>
  );
}

function useDialogBehavior(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Link modal                                                                 */
/* -------------------------------------------------------------------------- */

interface LinkModalProps {
  categories: CategoryWithLinks[];
  editing: LinkItem | null;
  defaultCategoryId: string;
  onClose: () => void;
  onSubmit: (draft: LinkDraft, icon: Blob | null) => Promise<void>;
}

type FetchState = 'idle' | 'loading' | 'done' | 'empty';

export function LinkModal({
  categories,
  editing,
  defaultCategoryId,
  onClose,
  onSubmit,
}: LinkModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [categoryId, setCategoryId] = useState(
    editing?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '',
  );

  // Pending upload: only set when the user explicitly fetched/uploaded a NEW icon.
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useDialogBehavior(onClose);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Revoke preview URLs — a leaked object URL pins the blob in memory.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Existing record icon (already hosted by PocketBase) until a new one is fetched.
  const previewUrl = objectUrl || (editing?.icon ?? '');

  const applyBlob = (blob: Blob) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setIconBlob(blob);
    setObjectUrl(URL.createObjectURL(blob));
  };

  const handleFetchIcon = async () => {
    if (!url.trim()) {
      setError('请先填写目标网址，再获取图标');
      return;
    }

    setError('');
    setNotice('');
    setFetchState('loading');

    const { blob, failure } = await fetchIcon(url);

    if (!blob) {
      setFetchState('empty');
      setNotice(
        failure === 'ip-or-port-unreachable'
          ? '该地址是 IP 或带端口，图标服务无法解析它，且该站点未开放跨域读取。请点「上传图标」选择本地图片文件。'
          : '未获取到该站点的图标。可点「上传图标」选择本地图片，或稍后重试。',
      );
      return;
    }

    applyBlob(blob);
    setFetchState('done');
  };

  const handleUploadIcon = (file: File | null) => {
    if (!file) return;
    setError('');
    setNotice('');

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('图标格式需为 PNG / JPEG / WEBP / ICO / GIF');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('图标文件不能超过 2 MB');
      return;
    }

    applyBlob(file);
    setFetchState('done');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请填写站点名称');
      return;
    }
    if (!url.trim()) {
      setError('请填写目标网址');
      return;
    }
    if (!categoryId) {
      setError('请选择所属分类');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSubmit(
        {
          category_id: categoryId,
          title: title.trim(),
          url: ensureProtocol(url),
          description: description.trim(),
        },
        iconBlob,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const previewTitle = title.trim() || hostnameOf(url) || '新网址';
  const previewMeta = [description.trim() || '一句话简介', hostnameOf(url)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '编辑网址书签' : '添加网址书签'}
      >
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{editing ? '编辑网址书签' : '添加网址书签'}</h2>
            <p className="dialog-sub">
              {editing
                ? '修改后将实时同步至 PocketBase'
                : '输入网址后可一键抓取站点图标，保存时随记录上传至 PocketBase'}
            </p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="关闭">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="preview">
          <IconPreview title={previewTitle} url={url} iconUrl={previewUrl} />
          <div className="preview-texts">
            <div className="preview-name">{previewTitle}</div>
            <div className="preview-meta">{previewMeta || '暂无简介'}</div>
          </div>
          <span className="preview-tag">{iconBlob ? '待上传' : '实时预览'}</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="link-title">
            站点名称
          </label>
          <input
            id="link-title"
            ref={titleRef}
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如 Raycast"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="link-url">
            目标网址 (URL)
            <span className="field-hint">未填写协议将自动补全 https://</span>
          </label>
          <div className="input-row">
            <input
              id="link-url"
              className="input"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setFetchState('idle');
                setNotice('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleFetchIcon();
                }
              }}
              placeholder="https://www.raycast.com"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className="fetch-btn"
              onClick={() => void handleFetchIcon()}
              disabled={fetchState === 'loading'}
              data-done={fetchState === 'done'}
              title="从 CORS 可用的图标源抓取真实站点图标"
            >
              {fetchState === 'loading' ? (
                <>
                  <Loader2 size={13} className="spin" />
                  获取中
                </>
              ) : fetchState === 'done' ? (
                <>
                  <Check size={13} strokeWidth={2.4} />
                  已获取
                </>
              ) : (
                <>
                  <Wand2 size={13} strokeWidth={2} />
                  获取图标
                </>
              )}
            </button>
          </div>
          <div className="icon-actions">
            <button
              type="button"
              className="upload-btn"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={12} strokeWidth={2} />
              {iconBlob ? '更换图标' : '上传图标'}
            </button>
            <span className="field-hint">PNG / JPEG / WEBP / ICO / GIF，≤ 2 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/x-icon,image/gif"
              hidden
              onChange={(event) => {
                handleUploadIcon(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="link-desc">
            一句话简介<span className="field-hint">选填</span>
          </label>
          <input
            id="link-desc"
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例如 极速键盘启动器与效率控制中心"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="link-category">
            所属分类
          </label>
          <div className="select-wrap">
            <select
              id="link-category"
              className="select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-chevron" strokeWidth={2} />
          </div>
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        ) : null}

        {!error && notice ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }} role="status">
            {notice}
          </p>
        ) : null}

        <div className="dialog-foot">
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? <Loader2 size={13} className="spin" /> : null}
            {editing ? '保存修改' : '保存书签'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category modal                                                              */
/* -------------------------------------------------------------------------- */

interface CategoryModalProps {
  editing: CategoryWithLinks | null;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function CategoryModal({ editing, onClose, onSubmit }: CategoryModalProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useDialogBehavior(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    if (!name.trim()) {
      setError('请填写分类名称');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog narrow"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '重命名分类' : '新建分类'}
      >
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">{editing ? '重命名分类' : '新建分类'}</h2>
            <p className="dialog-sub">分类用于将书签分组展示，可随时调整</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="关闭">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="category-name">
            分类名称
          </label>
          <input
            id="category-name"
            ref={inputRef}
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="例如 常用效率"
            spellCheck={false}
          />
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-foot">
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 size={13} className="spin" /> : null}
            {editing ? '保存' : '创建分类'}
          </button>
        </div>
      </div>
    </div>
  );
}
