import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { API_BASE } from '../../lib/apiBase';
import { Button } from '../ui/Button';

/**
 * 10-03 — the logo on an institution's card in the apps' "Find your school" list (the group's logo,
 * or a standalone school's own). Platform-managed. The image is trimmed of transparent edges,
 * centred on a square and scaled to 256 px here, so the server only stores a small PNG. Shown on a
 * white tile, exactly as the apps show it in light and dark mode.
 */
export function PickerLogoField({ kind, id, name }: { kind: 'institution' | 'school'; id: string; name: string }) {
  const [version, setVersion] = useState(() => Date.now());
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const dataUrl = await prepareLogo(file);
      await api.put(`/logos/${kind}/${id}`, { dataUrl });
      setMissing(false); setVersion(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the logo');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { await api.delete(`/logos/${kind}/${id}`); setMissing(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the logo'); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2" data-testid="picker-logo">
      <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden" title={`App logo for ${name}`}>
        {missing
          ? <ImageIcon size={16} className="text-gray-300" />
          : <img src={`${API_BASE}/logos/${kind}/${id}?v=${version}`} alt={`${name} logo`} className="w-8 h-8 object-contain" onError={() => setMissing(true)} />}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} className="mr-1.5" />{missing ? 'Add app logo' : 'Replace logo'}</Button>
      {!missing && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void remove()} aria-label="Remove app logo"><Trash2 size={14} /></Button>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

/** Trim transparent edges, centre on a square with a little padding, scale to 256 px, PNG. */
async function prepareLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP image');
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not read that image'));
    i.src = URL.createObjectURL(file);
  });
  const src = document.createElement('canvas');
  src.width = img.naturalWidth; src.height = img.naturalHeight;
  const sctx = src.getContext('2d')!;
  sctx.drawImage(img, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, src.width, src.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3]! > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) throw new Error('That image is fully transparent');
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const side = Math.round(Math.max(w, h) * 1.08);
  const out = document.createElement('canvas');
  out.width = 256; out.height = 256;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  const scale = 256 / side;
  octx.drawImage(src, minX, minY, w, h, ((side - w) / 2) * scale, ((side - h) / 2) * scale, w * scale, h * scale);
  return out.toDataURL('image/png');
}
