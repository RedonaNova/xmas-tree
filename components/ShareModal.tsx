import React, { useEffect, useState } from 'react';
import { X, Loader2, Copy, Check, Share2, Link2, KeyRound } from 'lucide-react';
import { ApiError } from '../utils/api';
import { slugify, sanitizeSlugInput, SLUG_RE } from '../utils/slug';

export interface SaveResult {
  slug: string;
  editToken: string | null;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  /** Slug of the tree currently open (if any) */
  currentSlug: string | null;
  /** True if this browser holds the edit token for currentSlug */
  canUpdate: boolean;
  photoCount: number;
  progress: string;
  onSave: (opts: { name: string; slug: string; mode: 'create' | 'update' }) => Promise<SaveResult>;
}

const ERROR_TEXT: Record<string, string> = {
  bad_slug: 'Холбоос зөвхөн латин үсэг, тоо, зураас (-) агуулна.',
  no_photos: 'Дор хаяж нэг зураг нэмнэ үү.',
  rate_limited: 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.',
  forbidden: 'Энэ модыг засах эрх алга. Шинэ холбоосоор хадгална уу.',
  unauthorized: 'Энэ модыг засах эрх алга. Шинэ холбоосоор хадгална уу.',
  too_large: 'Зураг хэт том байна.',
  unsupported_image: 'Энэ төрлийн зургийг дэмжихгүй байна.',
};

const CopyRow: React.FC<{ value: string; icon: React.ReactNode }> = ({ value, icon }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl pl-3 pr-1 py-1">
      <span className="text-white/40 shrink-0">{icon}</span>
      <input readOnly value={value} onFocus={e => e.target.select()} className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none" />
      <button onClick={copy} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors">
        {copied ? <Check size={14} className="text-[#1cbd62]" /> : <Copy size={14} />}
        {copied ? 'Хуулагдлаа' : 'Хуулах'}
      </button>
    </div>
  );
};

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen, onClose, initialName, currentSlug, canUpdate, photoCount, progress, onSave
}) => {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SaveResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setSlug(slugify(initialName));
    setSlugEdited(false);
    setError('');
    setResult(null);
    // Only when the dialog opens: saving updates initialName, which must not wipe the result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const host = window.location.host;

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const save = async (mode: 'create' | 'update') => {
    setError('');
    if (photoCount === 0) {
      setError(ERROR_TEXT.no_photos);
      return;
    }
    const finalSlug = mode === 'update' ? currentSlug! : slug.replace(/^-+|-+$/g, '');
    if (mode === 'create' && finalSlug && !SLUG_RE.test(finalSlug)) {
      setError(ERROR_TEXT.bad_slug);
      return;
    }
    setSaving(true);
    try {
      setResult(await onSave({ name: name.trim(), slug: finalSlug, mode }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slug_taken') {
        setSlug(err.data.suggestion || '');
        setSlugEdited(true);
        setError('Энэ холбоос аль хэдийн ашиглагдсан байна. Өөр холбоос санал болголоо.');
      } else {
        const code = err instanceof ApiError ? err.code : '';
        setError(ERROR_TEXT[code] || 'Хадгалж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.');
      }
    } finally {
      setSaving(false);
    }
  };

  const link = result ? `${origin}/${result.slug}` : '';
  const editLink = result?.editToken ? `${origin}/${result.slug}#edit=${result.editToken}` : '';

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Merry Christmas!', url: link });
    } catch {
      // user cancelled
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      onDoubleClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0a0a0a] border border-white/15 rounded-2xl shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1cbd62] via-[#f2e24e] to-[#ff421c]" />
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors disabled:opacity-30"
          aria-label="Хаах"
        >
          <X size={22} />
        </button>

        <div className="p-5 sm:p-7 space-y-5">
          {!result ? (
            <>
              <div>
                <h2 className="text-xl font-semibold text-white">Хадгалах ба хуваалцах</h2>
                <p className="text-white/50 text-sm mt-1">Модоо хадгалаад холбоосоор нь найз нөхөддөө илгээгээрэй.</p>
              </div>

              {canUpdate && currentSlug ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/70">
                    Таны мод: <span className="text-[#fff1a1] break-all">{host}/{currentSlug}</span>
                  </p>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#fff1a1]/80">Мэндчилгээнд гарах нэр</span>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      maxLength={60}
                      placeholder="Жишээ нь: Хулан"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-[#1cbd62]"
                    />
                  </label>
                  <button
                    onClick={() => save('update')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-[#1cbd62] hover:bg-[#1faa6a] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {saving && <Loader2 size={18} className="animate-spin" />}
                    {saving ? progress || 'Хадгалж байна...' : 'Өөрчлөлтийг хадгалах'}
                  </button>
                  <button
                    onClick={() => save('create')}
                    disabled={saving}
                    className="w-full text-sm text-white/50 hover:text-white py-1 transition-colors disabled:opacity-40"
                  >
                    Эсвэл шинэ холбоосоор хадгалах
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#fff1a1]/80">Мэндчилгээнд гарах нэр</span>
                    <input
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                      maxLength={60}
                      placeholder="Жишээ нь: Хулан"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-[#1cbd62]"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#fff1a1]/80">Холбоос</span>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 focus-within:border-[#1cbd62]">
                      <span className="text-white/40 text-sm whitespace-nowrap">{host}/</span>
                      <input
                        value={slug}
                        onChange={e => {
                          setSlug(sanitizeSlugInput(e.target.value));
                          setSlugEdited(true);
                        }}
                        maxLength={40}
                        placeholder="khulan"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="flex-1 min-w-0 bg-transparent py-3 text-white placeholder-white/25 outline-none"
                      />
                    </div>
                    <span className="block text-[11px] text-white/35">Хоосон үлдээвэл санамсаргүй холбоос үүснэ.</span>
                  </label>
                  <button
                    onClick={() => save('create')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-[#1cbd62] hover:bg-[#1faa6a] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    {saving && <Loader2 size={18} className="animate-spin" />}
                    {saving ? progress || 'Хадгалж байна...' : 'Хадгалаад холбоос авах'}
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold text-white">Хадгалагдлаа! 🎄</h2>
                <p className="text-white/50 text-sm mt-1">Энэ холбоосыг хүссэн хүндээ илгээгээрэй.</p>
              </div>

              <CopyRow value={link} icon={<Link2 size={16} />} />

              {typeof navigator.share === 'function' && (
                <button
                  onClick={nativeShare}
                  className="w-full flex items-center justify-center gap-2 bg-[#1cbd62] hover:bg-[#1faa6a] text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  <Share2 size={18} /> Илгээх
                </button>
              )}

              {editLink && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#fff1a1]/80">Засах холбоос (зөвхөн өөртөө)</p>
                  <p className="text-xs text-white/45">
                    Энэ төхөөрөмжөөс шууд засах боломжтой. Өөр төхөөрөмжөөс засах бол энэ холбоосыг хадгалаад аваарай. Бусдад бүү өгөөрэй.
                  </p>
                  <CopyRow value={editLink} icon={<KeyRound size={16} />} />
                </div>
              )}

              <button onClick={onClose} className="w-full text-sm text-white/60 hover:text-white py-2 transition-colors">
                Хаах
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
