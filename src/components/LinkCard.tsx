import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import type { LinkItem } from '../types/nav';
import { fallbackFaviconUrl, hostnameOf, hueOf, initialOf } from '../lib/format';

interface LinkCardProps {
  link: LinkItem;
  manageMode: boolean;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
}

export function LinkCard({ link, manageMode, onEdit, onDelete }: LinkCardProps) {
  const storedIcon = link.icon?.trim() ?? '';
  const source = storedIcon || fallbackFaviconUrl(link.url);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [source]);

  const showImage = Boolean(source) && !broken;
  const tintStyle = {
    '--tint-h': String(hueOf(hostnameOf(link.url) || link.title)),
  } as CSSProperties;

  const icon = (
    <div className="card-icon" style={tintStyle} data-has-image={showImage && loaded}>
      {showImage ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="card-monogram">{initialOf(link.title)}</span>
      )}
    </div>
  );

  const body = (
    <div className="card-body">
      <div className="card-top">
        <span className="card-title">{link.title}</span>
        {manageMode ? (
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-icon small"
              title="编辑网址"
              aria-label={`编辑 ${link.title}`}
              onClick={() => onEdit(link)}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className="btn btn-icon small danger"
              title="删除网址"
              aria-label={`删除 ${link.title}`}
              onClick={() => onDelete(link)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <span className="card-arrow">
            <ArrowUpRight size={11} strokeWidth={2.2} />
          </span>
        )}
      </div>
      {link.description ? <span className="card-desc">{link.description}</span> : null}
    </div>
  );

  if (manageMode) {
    return (
      <div className="card">
        {icon}
        {body}
      </div>
    );
  }

  return (
    <a className="card" href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>
      {icon}
      {body}
    </a>
  );
}
