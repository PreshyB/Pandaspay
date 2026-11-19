import { useEffect, useRef, useState } from 'react';
import { MAX_PHOTOS, shrinkImage } from '../lib/images';

export interface PickedPhoto {
  key: string;
  blob: Blob;
  preview: string;
}

/** Choose photos before the product exists. The first photo is the cover; the rest keep the order chosen. */
export function PhotoPicker({ photos, onChange }: { photos: PickedPhoto[]; onChange: (next: PickedPhoto[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(photos);
  latest.current = photos;

  // Free the preview URLs when the picker goes away.
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const next = [...photos];
    try {
      for (const file of Array.from(files)) {
        if (next.length >= MAX_PHOTOS) {
          setError(`You can add up to ${MAX_PHOTOS} photos.`);
          break;
        }
        const blob = await shrinkImage(file);
        next.push({ key: `${Date.now()}-${next.length}`, blob, preview: URL.createObjectURL(blob) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that photo.');
    }
    onChange(next);
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  function remove(key: string) {
    const gone = photos.find((p) => p.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    onChange(photos.filter((p) => p.key !== key));
  }

  function makeCover(key: string) {
    const chosen = photos.find((p) => p.key === key);
    if (chosen) onChange([chosen, ...photos.filter((p) => p.key !== key)]);
  }

  return (
    <div className="photos">
      <ul className="photos__grid">
        {photos.map((p, i) => (
          <li key={p.key} className="photos__item">
            <img src={p.preview} alt={`Photo ${i + 1}`} />
            {i === 0 && <span className="photos__cover">Cover</span>}
            <div className="photos__actions">
              {i > 0 && (
                <button type="button" onClick={() => makeCover(p.key)}>
                  Make cover
                </button>
              )}
              <button type="button" onClick={() => remove(p.key)} aria-label={`Remove photo ${i + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button type="button" className="photos__add" onClick={() => input.current?.click()} disabled={busy}>
              <span aria-hidden="true">+</span>
              {busy ? 'Preparing…' : photos.length ? 'Add more' : 'Add photos'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void pick(e.target.files)} />
      <p className="field__hint" style={{ margin: 0 }}>
        Up to {MAX_PHOTOS} photos. The first is the cover buyers see first. Clear, well-lit photos of the real item sell best.
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
