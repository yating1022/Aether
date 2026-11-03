import { useEffect, useRef, useState } from 'react';

export interface IconSourceState {
  /** URL to render, or '' when every candidate failed (render the monogram). */
  source: string;
  /** True when a candidate is being attempted (image may still be loading). */
  showImage: boolean;
  /** True once the current candidate actually painted. */
  loaded: boolean;
  onLoad: () => void;
  onError: () => void;
}

/**
 * Walk a list of candidate icon URLs, advancing on each load failure.
 *
 * Why an `<img>` cascade instead of fetching the bytes: `fetch()` can only read a
 * cross-origin response when the server sends `Access-Control-Allow-Origin`, and
 * self-hosted nginx/IIS services (the usual `http://host:port` bookmarks) do not.
 * An `<img>` is not CORS-gated, so the browser can load those icons directly —
 * we just need `onError` to try the next path, because `/favicon.ico` is often a
 * 404 even when `/favicon.png` exists.
 *
 * The first candidate is normally the file uploaded to PocketBase, which must
 * win over anything derived from the URL.
 */
export function useIconSource(candidates: string[], resetKey: string): IconSourceState {
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Reset only when the inputs actually change. A mount-time reset would race a
  // fast failure: `onError` fires first, the reset clears it, and the browser
  // never re-fires `error` for an unchanged src — leaving a broken image.
  const previousKey = useRef(resetKey);
  useEffect(() => {
    if (previousKey.current === resetKey) return;
    previousKey.current = resetKey;
    setIndex(0);
    setExhausted(false);
    setLoaded(false);
  }, [resetKey]);

  const source = exhausted ? '' : (candidates[index] ?? '');

  const onLoad = () => setLoaded(true);

  const onError = () => {
    setLoaded(false);
    if (index + 1 < candidates.length) {
      setIndex(index + 1);
    } else {
      setExhausted(true);
    }
  };

  return {
    source,
    showImage: Boolean(source),
    loaded,
    onLoad,
    onError,
  };
}
