import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { login } from '../api/pocketbase';
import type { AuthUser } from '../types/nav';

interface LoginDialogProps {
  /** Where to return after a successful sign-in (e.g. enable manage mode). */
  reason?: string;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export function LoginDialog({ reason, onClose, onSuccess }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('请输入邮箱与密码');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      onSuccess(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog narrow" role="dialog" aria-modal="true" aria-label="编辑者登录">
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title">编辑者登录</h2>
            <p className="dialog-sub">
              {reason ?? '登录后即可管理分类与站点，数据保存至 PocketBase'}
            </p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="关闭">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="login-email">
            邮箱
          </label>
          <input
            id="login-email"
            ref={emailRef}
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="editor@example.com"
            autoComplete="username"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="login-password">
            密码
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-foot">
          <button type="button" className="btn btn-soft" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : null}
            登录
          </button>
        </div>
      </div>
    </div>
  );
}
