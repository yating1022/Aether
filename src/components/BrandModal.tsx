import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Upload, X } from 'lucide-react';
import type { BrandSettings } from '../types/nav';
import { useDialogBehavior } from '../lib/useDialogBehavior';

interface BrandModalProps {
  brand: BrandSettings;
  onClose: () => void;
  onSubmit: (input: { title: string; logo: Blob | null; removeLogo: boolean }) => Promise<void>;
}

const DEFAULT_TITLE = 'Aether';
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/x-icon,image/gif';

/**
 * Site branding editor. Unlike the link dialog there is no icon scraping here:
 * a site logo is deliberately a local upload, so the preview is either the
 * uploaded file or the current remote one.
 */
export function BrandModal({ brand, onClose, onSubmit }: BrandModalProps) {
  const [title, setTitle] = useState(brand.title);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState(brand.logo);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useDialogBehavior(onClose);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // A leaked object URL pins the blob in memory for the page's lifetime.
  useEffect(
    () => () => {
      if (logoBlob) URL.revokeObjectURL(previewUrl);
    },
    [logoBlob, previewUrl],
  );

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError('图标需为 PNG / JPEG / WEBP / ICO / GIF');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('图标不能超过 2 MB');
      return;
    }
    setError('');
    setLogoBlob(file);
    setRemoveLogo(false);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoBlob(null);
    setRemoveLogo(true);
    setPreviewUrl('');
  };

  const restoreDefault = () => {
    setTitle(DEFAULT_TITLE);
    clearLogo();
    setError('');
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed.length > 60) {
      setError('标题不能超过 60 个字符');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        title: trimmed,
        logo: logoBlob,
        // Removing only makes sense when there is no replacement file.
        removeLogo: !logoBlob && removeLogo,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const effectiveTitle = title.trim() || DEFAULT_TITLE;

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog narrow" role="dialog" aria-modal="true" aria-label="站点设置">
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">站点设置</h2>
            <p className="dialog-sub">自定义页头标题与图标，保存后同步至 PocketBase</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="关闭">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="preview">
          <div className="preview-icon" data-has-image={Boolean(previewUrl)}>
            {previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.5 20 19.5H4L12 3.5Z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div className="preview-texts">
            <div className="preview-name">{effectiveTitle}</div>
            <div className="preview-meta">
              {logoBlob ? '图标待上传' : previewUrl ? '当前自定义图标' : '使用默认标记'}
            </div>
          </div>
          <span className="preview-tag">{logoBlob ? '待上传' : '实时预览'}</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="brand-title">
            站点标题
            <span className="field-hint">留空则显示默认 {DEFAULT_TITLE}</span>
          </label>
          <input
            id="brand-title"
            ref={inputRef}
            className="input"
            value={title}
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={DEFAULT_TITLE}
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="field-label">站点图标</label>
          <div className="icon-actions">
            <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()}>
              <Upload size={12} strokeWidth={2} />
              {previewUrl ? '更换图标' : '上传图标'}
            </button>
            {previewUrl ? (
              <button type="button" className="upload-btn" onClick={clearLogo}>
                <X size={12} strokeWidth={2} />
                移除图标
              </button>
            ) : null}
            <span className="field-hint">PNG / JPEG / WEBP / ICO / GIF，≤ 2 MB</span>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              hidden
              onChange={(event) => {
                pickFile(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-foot">
          <button type="button" className="btn btn-soft" onClick={restoreDefault} disabled={saving}>
            <RotateCcw size={13} strokeWidth={2} />
            恢复默认
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? <Loader2 size={13} className="spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
