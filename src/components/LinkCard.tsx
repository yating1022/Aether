import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import type { LinkItem } from '../types/nav';
import { fallbackFaviconUrl, hostnameOf, hueOf, initialOf } from '../lib/format';
import { directIconCandidates } from '../lib/icon';
import { useIconSource } from '../lib/useIconSource';

interface LinkCardProps {
  link: LinkItem;
  manageMode: boolean;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
  /**
   * Drag activator, injected by SortableLinkCard so this component stays free of
   * dnd-kit. Only the handle receives the listeners — dragging must not swallow
   * the card's normal touch scrolling.
   */
  dragHandle?: ReactNode;
}

export function LinkCard({ link, manageMode, onEdit, onDelete, dragHandle }: LinkCardProps) {
  /**
   * Candidate icon sources, in priority order:
   *   1. the file uploaded to PocketBase (explicit user choice)
   *   2. for plain-http bookmarks, the site's own /favicon.* paths
   *   3. a hostname-keyed icon service
   *
   * Plain-http targets need the `<img>`-based route because reading their bytes
   * with `fetch()` requires CORS headers that self-hosted servers do not send.
   * An `<img>` is not CORS-gated, so the browser can fetch it directly.
   */
  const candidates = useMemo(() => {
    const stored = link.icon?.trim();
    if (stored) return [stored];

    const direct = directIconCandidates(link.url);
    const thirdParty = fallbackFaviconUrl(link.url);
    return [...direct, ...(thirdParty ? [thirdParty] : [])];
  }, [link.icon, link.url]);

  const { source, showImage, loaded, onLoad, onError } = useIconSource(
    candidates,
    `${link.id}|${link.icon}|${link.url}`,
  );

  const tintStyle = {
    '--tint-h': String(hueOf(hostnameOf(link.url) || link.title)),
  } as CSSProperties;

  // The monogram is always rendered underneath. Without it a card whose icon is
  // still loading (or below the fold, where lazy loading has not started) shows
  // an empty tinted well, which reads as broken.
  const icon = (
    <div className="card-icon" style={tintStyle} data-has-image={showImage && loaded}>
      <span className="card-monogram">{initialOf(link.title)}</span>
      {showImage ? (
        <img
          // Keying on the source makes React replace the element on each
          // candidate, which is what allows the next attempt to fire its events.
          key={source}
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          data-ready={loaded}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
    </div>
  );

  const body = (
    <div className="card-body">
      <div className="card-top">
        <span className="card-title">{link.title}</span>
        {manageMode ? (
          <div className="card-actions">
            {dragHandle}
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
