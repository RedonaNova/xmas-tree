import React, { useState, useEffect, useRef, useCallback } from 'react';
import Scene from './components/Scene';
import Overlay from './components/Overlay';
import HandController from './components/HandController';
import { generatePhotoPositions } from './utils/math';
import { ControlMode, PhotoData, InteractionMode } from './types';
import { DEFAULT_PHOTOS_COUNT, PLACEHOLDER_TYPES } from './constants';
import { useAudio } from './hooks/useAudio';
import { useRecording } from './hooks/useRecording';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { processImageWithPadding } from './utils/image';
import {
  fetchTree, createTree, updateTree, uploadPhoto, imageUrl,
  getEditToken, setEditToken, consumeEditLinkToken, SavedTree, TreeSlot
} from './utils/api';
import ShareModal, { SaveResult } from './components/ShareModal';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

// "/" -> empty tree, visitors decorate it themselves (Edit mode).
// "/<slug>" -> saved tree from the server, opened in View mode.
const getSlugFromPath = (): string => {
  const segment = window.location.pathname.split('/').filter(Boolean)[0] || '';
  return /^[a-z0-9-]{1,40}$/.test(segment) ? segment : '';
};
const INITIAL_SLUG = getSlugFromPath();
consumeEditLinkToken(INITIAL_SLUG);

const slotIndex = (photo: PhotoData) => Number(photo.id.replace('photo-', ''));

const createPlaceholderPhotos = (): PhotoData[] => {
  const types = Object.values(PLACEHOLDER_TYPES);
  return generatePhotoPositions(DEFAULT_PHOTOS_COUNT).map((pos, index) => ({
    id: `photo-${index}`,
    url: '', // Empty means use placeholder
    placeholderType: types[index % types.length],
    position: pos.position,
    rotation: pos.rotation
  }));
};

/**
 * Puts new image URLs into FREE slots only (placeholders, then spots where a photo was
 * deleted), from the top of the tree down. Existing photos are never overwritten.
 */
const fillFreeSlots = (current: PhotoData[], urls: string[]) => {
  const bySlot = new Map(current.map(p => [slotIndex(p), p]));
  const all = createPlaceholderPhotos();
  const free = all
    .filter(p => !bySlot.get(slotIndex(p))?.url)
    .sort((a, b) => b.position[1] - a.position[1]);

  const added = new Map<number, string>();
  urls.slice(0, free.length).forEach((url, k) => added.set(slotIndex(free[k]), url));

  let last: PhotoData | null = null;
  const next: PhotoData[] = [];
  for (const slot of all) {
    const i = slotIndex(slot);
    const existing = bySlot.get(i);
    const url = added.get(i);
    if (url) {
      const photo = { ...(existing || slot), url };
      next.push(photo);
      last = photo;
    } else if (existing) {
      next.push(existing);
    }
    // deleted slot that got nothing stays deleted
  }
  return { next, last: last as PhotoData | null, skipped: Math.max(0, urls.length - free.length) };
};

/** Rebuilds the tree's photos from a saved tree (deleted slots stay deleted). */
const photosFromSavedTree = (tree: SavedTree): PhotoData[] => {
  const bySlot = new Map(tree.slots.map(s => [s.i, s.img]));
  return createPlaceholderPhotos()
    .filter(p => bySlot.has(slotIndex(p)))
    .map(p => {
      const img = bySlot.get(slotIndex(p));
      return img ? { ...p, url: imageUrl(img) } : p;
    });
};

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>(ControlMode.MOUSE);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(
    INITIAL_SLUG ? InteractionMode.VIEW : InteractionMode.EDIT
  );
  const [photos, setPhotos] = useState<PhotoData[]>(createPlaceholderPhotos);
  const [userName, setUserName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [isHandReady, setIsHandReady] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(!!INITIAL_SLUG);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [editToken, setEditTokenState] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  // Shared links open like a card: buttons hidden, only the eye button to bring them back
  const [showUI, setShowUI] = useState(!INITIAL_SLUG);
  const [saveProgress, setSaveProgress] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Custom Hooks
  const { isMusicPlaying, toggleMusic, audioRef } = useAudio();
  const { isRecording, recordingType, handleRecordVideo } = useRecording(photos, (msg) => showToast(msg, 'error'));

  const {
    zoomLevel,
    setZoomLevel,
    focusedPhoto,
    setFocusedPhoto,
    isExploded,
    panOffset,
    viewResetKey,
    handleGesture,
    handlePhotoClick,
    handleNextPhoto,
    handlePrevPhoto,
    scrollToTop
  } = useTreeInteraction({
    photos,
    interactionMode,
    isRecording
  });

  // Load a saved tree (/khulan etc.)
  useEffect(() => {
    if (!INITIAL_SLUG) return;
    let cancelled = false;

    fetchTree(INITIAL_SLUG)
      .then(tree => {
        if (cancelled) return;
        setPhotos(photosFromSavedTree(tree));
        setUserName(tree.name);
        setIsNameSet(true);
        setCurrentSlug(tree.slug);
        setEditTokenState(getEditToken(tree.slug));
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        setInteractionMode(InteractionMode.EDIT);
        setShowUI(true);
        history.replaceState(null, '', '/');
        showToast(err?.status === 404
          ? `"${INITIAL_SLUG}" холбоостой мод олдсонгүй. Өөрийн модоо чимэглээд хуваалцаарай.`
          : 'Модыг ачаалж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.', 'error');
      })
      .finally(() => {
        if (!cancelled) setIsTreeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Edit link pasted into an already-open tab only changes the #hash (no reload)
  useEffect(() => {
    const onHashChange = () => {
      if (!currentSlug) return;
      consumeEditLinkToken(currentSlug);
      setEditTokenState(getEditToken(currentSlug));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentSlug]);

  const handleSave = async ({ name, slug, mode }: { name: string; slug: string; mode: 'create' | 'update' }): Promise<SaveResult> => {
    const withImages = photos.filter(p => p.url);
    const slots: TreeSlot[] = [];
    let done = 0;
    setSaveProgress(`Зураг илгээж байна 0/${withImages.length}`);

    // Upload a few photos at a time
    const queue = [...photos];
    const worker = async () => {
      while (queue.length) {
        const photo = queue.shift()!;
        if (!photo.url) {
          slots.push({ i: slotIndex(photo), img: null });
          continue;
        }
        const img = await uploadPhoto(photo.url);
        slots.push({ i: slotIndex(photo), img });
        done++;
        setSaveProgress(`Зураг илгээж байна ${done}/${withImages.length}`);
      }
    };
    try {
      await Promise.all([worker(), worker(), worker()]);
      setSaveProgress('Хадгалж байна...');

      let result: SaveResult;
      if (mode === 'update' && currentSlug && editToken) {
        await updateTree(currentSlug, editToken, { name, slots });
        result = { slug: currentSlug, editToken };
      } else {
        const created = await createTree({ name, slug, slots });
        setEditToken(created.slug, created.editToken);
        result = { slug: created.slug, editToken: created.editToken };
      }

      // Show stored images from now on, and put the link in the address bar
      setPhotos(prev => prev.map(p => {
        const slot = slots.find(s => s.i === slotIndex(p));
        return slot?.img ? { ...p, url: imageUrl(slot.img) } : p;
      }));
      setCurrentSlug(result.slug);
      setEditTokenState(result.editToken);
      setUserName(name);
      setIsNameSet(true);
      history.replaceState(null, '', `/${result.slug}`);
      return result;
    } finally {
      setSaveProgress('');
    }
  };

  // Request Camera permissions when switching to hand mode
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if (controlMode === ControlMode.HAND) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          currentStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsHandReady(true);
          }
        })
        .catch((err) => {
          console.error("Camera denied:", err);
          showToast("Гараар удирдахын тулд камер ашиглах зөвшөөрөл өгнө үү.", 'error');
          setControlMode(ControlMode.MOUSE);
        });
    } else {
      // Stop stream if exists
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      setIsHandReady(false);
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [controlMode]);

  const isUiTarget = (target: EventTarget | null) =>
    !!(target as HTMLElement | null)?.closest?.('button, input, a, [role="dialog"]');

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Prevent zooming out when interacting with UI
    if (isUiTarget(e.target)) return;
    // Already handled as a touch double tap (Android also fires dblclick)
    if (Date.now() - lastDoubleTap.current < 600) return;
    scrollToTop();
  };

  // Double tap on touch screens (iOS Safari does not fire dblclick reliably):
  // back to the tree from a photo, or reset the view on the full tree.
  const tapStart = useRef({ t: 0, x: 0, y: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const lastDoubleTap = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    tapStart.current = { t: Date.now(), x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || isUiTarget(e.target)) return;
    const now = Date.now();
    const s = tapStart.current;
    const isTap = now - s.t < 300 && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10;
    if (!isTap) return;
    const prev = lastTap.current;
    if (now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
      lastDoubleTap.current = now;
      lastTap.current = { t: 0, x: 0, y: 0 };
      scrollToTop();
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  const handleSingleUpload = async (id: string, file: File) => {
    const rawUrl = URL.createObjectURL(file);
    const url = await processImageWithPadding(rawUrl);

    // Revoke the raw object URL if we created a new data URL
    if (url !== rawUrl) {
      URL.revokeObjectURL(rawUrl);
    }

    const photoToUpdate = photos.find(p => p.id === id);
    if (photoToUpdate) {
      const updatedPhoto = { ...photoToUpdate, url };
      setPhotos(prev => prev.map(p => p.id === id ? updatedPhoto : p));

      // Switch to VIEW mode and focus
      setInteractionMode(InteractionMode.VIEW);
      handlePhotoClick(updatedPhoto);
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    const freeCount = DEFAULT_PHOTOS_COUNT - photos.filter(p => p.url).length;
    const chosen = Array.from(files);
    if (freeCount <= 0) {
      showToast(`Модон дээр ${DEFAULT_PHOTOS_COUNT} зураг дүүрсэн байна. Зураг солих бол "Засах" горимд зураг дээр дарна уу.`, 'error');
      return;
    }

    const urls: string[] = [];
    for (const file of chosen.slice(0, freeCount)) {
      const rawUrl = URL.createObjectURL(file);
      const url = await processImageWithPadding(rawUrl);
      if (url !== rawUrl) {
        URL.revokeObjectURL(rawUrl);
      }
      urls.push(url);
    }

    const { next, last } = fillFreeSlots(photos, urls);
    setPhotos(next);
    if (chosen.length > freeCount) {
      showToast(`Сул байр ${freeCount} байсан тул эхний ${freeCount} зургийг нэмлээ.`, 'error');
    }

    if (last) {
      // Switch to VIEW mode and focus
      setInteractionMode(InteractionMode.VIEW);
      handlePhotoClick(last);
    }
  };

  const handleDeletePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (focusedPhoto?.id === id) {
      setFocusedPhoto(null);
    }
  };

  return (
    <div
      className="relative w-full h-full bg-[#050505]"
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <audio
        ref={audioRef}
        src="/assets/music/christmas-song.mp3"
        loop
        preload="auto"
      />

      <Scene
        photos={photos}
        onUpload={handleSingleUpload}
        onPhotoClick={handlePhotoClick}
        onDelete={handleDeletePhoto}
        controlMode={controlMode}
        interactionMode={interactionMode}
        zoomLevel={zoomLevel}
        panOffset={panOffset}
        viewResetKey={viewResetKey}
        focusedPhoto={focusedPhoto}
        isExploded={isExploded}
        isRecording={isRecording}
        recordingType={recordingType}
        userName={userName}
      />

      <Overlay
        controlMode={controlMode}
        setControlMode={setControlMode}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        onBulkUpload={handleBulkUpload}
        onNext={handleNextPhoto}
        onPrev={handlePrevPhoto}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        isHandReady={isHandReady}
        isMusicPlaying={isMusicPlaying}
        toggleMusic={toggleMusic}
        userName={userName}
        setUserName={setUserName}
        isNameSet={isNameSet}
        setIsNameSet={setIsNameSet}
        onRecordVideo={handleRecordVideo}
        onOpenShare={() => setIsShareOpen(true)}
        showUI={showUI}
        setShowUI={setShowUI}
        isRecording={isRecording}
        isExploded={isExploded}
      />

      <HandController
        mode={controlMode}
        zoomLevel={zoomLevel}
        isExploded={isExploded}
        onGesture={handleGesture}
        videoRef={videoRef}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        initialName={userName}
        currentSlug={currentSlug}
        canUpdate={!!editToken}
        photoCount={photos.filter(p => p.url).length}
        progress={saveProgress}
        onSave={handleSave}
      />

      {isTreeLoading && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none">
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/10 text-white/80 text-sm shadow-2xl">
            <Loader2 className="w-4 h-4 animate-spin text-[#fff1a1]" />
            Модыг ачаалж байна...
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 fade-in duration-300">
          <div className={`min-w-[300px] max-w-md p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
            toast.type === 'error'
              ? 'bg-red-950/40 border-red-500/30 text-red-100'
              : 'bg-green-950/40 border-green-500/30 text-green-100'
          } flex items-start gap-4 relative overflow-hidden group`}>
            {/* Progress bar background */}
            <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full" />
            {/* Animated progress bar */}
            <div className={`absolute bottom-0 left-0 h-1 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'} animate-[shrink_5s_linear_forwards]`} />

            <div className={`p-2 rounded-xl ${toast.type === 'error' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
            </div>

            <div className="flex-1 pt-0.5">
              <h4 className="text-sm font-bold tracking-tight mb-1">
                {toast.type === 'error' ? 'Алдаа гарлаа' : 'Амжилттай!'}
              </h4>
              <p className="text-xs text-white/70 leading-relaxed font-medium">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => setToast(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
