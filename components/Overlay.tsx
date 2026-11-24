import React, { useEffect, useRef, useState } from 'react';
import { ControlMode, ZoomLevel, InteractionMode } from '../types';
import { Mouse, Hand, ImagePlus, Music, VolumeX, Eye, EyeOff, Edit3, Download, Maximize, Move, ChevronLeft, ChevronRight, Video, Share2 } from 'lucide-react';

interface OverlayProps {
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  onBulkUpload: (files: FileList) => void;
  onNext: () => void;
  onPrev: () => void;
  zoomLevel: ZoomLevel;
  setZoomLevel: (level: ZoomLevel) => void;
  isHandReady: boolean;
  isMusicPlaying: boolean;
  toggleMusic: () => void;
  userName: string;
  setUserName: (name: string) => void;
  isNameSet: boolean;
  setIsNameSet: (set: boolean) => void;
  onRecordVideo: (type: 'FULL' | 'ALBUM') => void;
  onOpenShare: () => void;
  showUI: boolean;
  setShowUI: (show: boolean) => void;
  isRecording: boolean;
  isExploded?: boolean;
}

// "Merry Christmas" stays in Great Vibes; names use Bad Script, which has all
// Mongolian Cyrillic letters (Great Vibes is missing Ө ө Ү ү).
const GREETING_FONT = "'Great Vibes', cursive";
const NAME_FONT = "'Bad Script', cursive";
const NAME_SCALE = 0.8;

const PeaceIcon =({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 12V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7" />
    <path d="M10 12V8a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
  </svg>
);

const Overlay: React.FC<OverlayProps> = ({
  controlMode,
  setControlMode,
  interactionMode,
  setInteractionMode,
  onBulkUpload,
  onNext,
  onPrev,
  zoomLevel,
  setZoomLevel,
  isHandReady,
  isMusicPlaying,
  toggleMusic,
  userName,
  setUserName,
  isNameSet,
  setIsNameSet,
  onRecordVideo,
  onOpenShare,
  showUI,
  setShowUI,
  isRecording,
  isExploded
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTouch = isMobile || window.matchMedia?.('(pointer: coarse)').matches;
  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';
  const [videoMenuOpen, setVideoMenuOpen] = useState(false);
  const [showTouchHint, setShowTouchHint] = useState(isTouch);

  useEffect(() => {
    if (!showTouchHint) return;
    const t = setTimeout(() => setShowTouchHint(false), 8000);
    return () => clearTimeout(t);
  }, [showTouchHint]);

  const triggerBulkUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    const overlay = document.getElementById('overlay-container');
    if (overlay) overlay.style.display = 'none';

    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
          // 1. Fill Black Background
          ctx.fillStyle = '#050505';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          // 2. Draw WebGL Canvas
          ctx.drawImage(canvas, 0, 0);

          // 3. Draw Title: "Merry Christmas" in Great Vibes, the name in Bad Script
          // (Great Vibes has no Mongolian Ө/Ү glyphs)
          const fontSize = Math.max(60, canvas.width / 25);
          const greetingFont = `${fontSize}px ${GREETING_FONT}`;
          const nameFont = `${Math.round(fontSize * NAME_SCALE)}px ${NAME_FONT}`;
          const greeting = userName ? 'Merry Christmas ' : 'Merry Christmas!';
          const name = userName ? `${userName}!` : '';

          ctx.fillStyle = '#fff1a1';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.shadowColor = 'rgba(255, 241, 161, 0.5)';
          ctx.shadowBlur = 20;

          ctx.font = greetingFont;
          const greetingWidth = ctx.measureText(greeting).width;
          ctx.font = nameFont;
          const nameWidth = name ? ctx.measureText(name).width : 0;

          const x = (tempCanvas.width - greetingWidth - nameWidth) / 2;
          const baseline = canvas.height * 0.05 + fontSize;
          ctx.font = greetingFont;
          ctx.fillText(greeting, x, baseline);
          if (name) {
            ctx.font = nameFont;
            ctx.fillText(name, x + greetingWidth, baseline);
          }

          const link = document.createElement('a');
          link.download = `merry-christmas-${userName || 'tree'}.png`;
          link.href = tempCanvas.toDataURL('image/png');
          link.click();
        }
      }
      if (overlay) overlay.style.display = 'flex';
    }, 100);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };


  // if (isRecording) return null; // Removed to keep title visible

  return (
    <div id="overlay-container" className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-between p-3 sm:p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">

      {/* Top Header - Just the Title */}
      <div className="flex flex-col justify-center items-center w-full relative pt-2 md:pt-8 [@media(max-height:500px)]:pt-0 px-4">
        <div className="pointer-events-auto text-center">
          <h1 className="text-3xl md:text-6xl [@media(max-height:500px)]:text-3xl text-[#fff1a1] leading-tight" style={{ fontFamily: GREETING_FONT, textShadow: '0 0 20px rgba(255, 241, 161, 0.5)' }}>
            {userName ? (
              <>
                Merry Christmas{' '}
                <span style={{ fontFamily: NAME_FONT, fontSize: `${NAME_SCALE}em` }}>{userName}!</span>
              </>
            ) : (
              'Merry Christmas!'
            )}
          </h1>
        </div>

        {!isRecording && !isNameSet && showUI && (
          <div className="pointer-events-auto mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-700">
            <p className="text-[#fff1a1]/60 text-[10px] uppercase tracking-[0.2em] font-bold">Таны нэр хэн бэ?</p>
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/10 shadow-lg group focus-within:border-white/30 transition-all">
              <input
                type="text"
                placeholder="Нэрээ бичнэ үү..."
                className="bg-transparent text-white text-sm outline-none w-40 placeholder:text-white/20"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userName.trim()) {
                    setIsNameSet(true);
                  }
                }}
              />
              <button
                onClick={() => userName.trim() && setIsNameSet(true)}
                className="text-[#fff1a1] hover:text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch gesture hint (phones/tablets, finger mode) */}
      {!isRecording && showUI && showTouchHint && controlMode === ControlMode.MOUSE && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[38%] [@media(max-height:500px)]:top-[18%] [@media(max-height:500px)]:scale-[0.8] origin-top pointer-events-auto z-20 w-max max-w-[calc(100%-2rem)]" onClick={() => setShowTouchHint(false)}>
          <div className="bg-black/55 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-3 text-white/85 text-xs shadow-2xl space-y-1.5">
            <div>☝️ <b className="font-semibold">Нэг хуруугаар чирэх</b> — эргүүлэх</div>
            <div>🤏 <b className="font-semibold">Хоёр хуруугаар чимхэх</b> — ойртуулах / холдуулах</div>
            <div>✌️ <b className="font-semibold">Хоёр хуруугаар чирэх</b> — зөөх</div>
            <div>👆👆 <b className="font-semibold">Хоёр товших</b> — анхны байрлал</div>
            <div>👆 <b className="font-semibold">Зураг дээр дарах</b> — {interactionMode === InteractionMode.EDIT ? 'зураг солих' : 'томруулж харах'}</div>
          </div>
        </div>
      )}

      {/* Instructions Pane - Responsive positioning */}
      <div className="absolute top-1/4 right-4 md:top-1/2 md:right-8 transform md:-translate-y-1/2 [@media(max-height:500px)]:scale-75 [@media(max-height:500px)]:origin-right pointer-events-none transition-all duration-500 z-20">
        {!isRecording && showUI && controlMode === ControlMode.HAND && (
          <div className="bg-white/5 backdrop-blur-3xl p-3 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 text-white/90 w-40 md:w-64 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-2 md:gap-4 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex items-center gap-2 md:gap-3 border-b border-white/10 pb-2 md:pb-3">
              <div className="p-1.5 md:p-2 bg-[#1cbd62]/20 rounded-full">
                <Hand className="w-4 h-4 md:w-5 md:h-5 text-[#1cbd62]" />
              </div>
              <h3 className="font-semibold tracking-wide uppercase text-[10px] md:text-xs">Гараар удирдах</h3>
            </div>

            <ul className="space-y-3 md:space-y-4">
              {isExploded ? (
                <>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <Move className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Гараа хөдөлгөх</span>
                      <span className="text-xs md:text-sm font-medium">Зургууд хөвнө</span>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <div className="w-3 h-3 md:w-4 md:h-4 rounded-sm md:rounded-md border-2 border-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Атгах</span>
                      <span className="text-xs md:text-sm font-medium">Буцааж цуглуулах</span>
                    </div>
                  </li>
                </>
              ) : zoomLevel === ZoomLevel.FULL_TREE ? (
                <>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <Move className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Гараа хөдөлгөх</span>
                      <span className="text-xs md:text-sm font-medium">
                        <span className="md:hidden">Эргүүлэх</span>
                        <span className="hidden md:inline">Модыг эргүүлэх</span>
                      </span>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <Hand className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Алгаа дэлгэх</span>
                      <span className="text-xs md:text-sm font-medium">Ойртуулах</span>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <PeaceIcon className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Хоёр хуруу (V)</span>
                      <span className="text-xs md:text-sm font-medium">Модыг задлах</span>
                    </div>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <Move className="w-4 h-4 md:w-[18px] md:h-[18px] text-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Гараа шудрах</span>
                      <span className="text-xs md:text-sm font-medium">
                        <span className="md:hidden">Дараах/Өмнөх</span>
                        <span className="hidden md:inline">Дараах / Өмнөх</span>
                      </span>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 md:gap-4 group">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                      <div className="w-3 h-3 md:w-4 md:h-4 rounded-sm md:rounded-md border-2 border-white/70" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider font-bold">Атгах</span>
                      <span className="text-xs md:text-sm font-medium">Холдуулах</span>
                    </div>
                  </li>
                </>
              )}
            </ul>

            {!isHandReady && (
              <div className="mt-1 md:mt-2 py-1.5 md:py-2 px-3 md:px-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[8px] md:text-[9px] text-center font-bold animate-pulse uppercase tracking-widest">
                <span className="md:hidden">Хүлээж байна...</span>
                <span className="hidden md:inline">Камер хүлээж байна...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls - Unified at the bottom */}
      {!isRecording && (
        <div className="flex flex-col items-center gap-3 md:gap-4 w-full mb-2 md:mb-6 [@media(max-height:500px)]:mb-0 [@media(max-height:500px)]:scale-[0.72] [@media(max-height:500px)]:origin-bottom pointer-events-auto px-0 md:px-4">
          {!showUI ? (
            /* Small Toggle to bring back UI */
            <button
              onClick={() => setShowUI(true)}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all shadow-2xl mb-4"
              title="Товчнуудыг харуулах"
            >
              <Eye size={24} />
            </button>
          ) : (
            /* Main Control Panel */
            <div className="flex flex-col items-center gap-2 md:gap-3 w-full max-w-full">

              {/* Top Row: System & View Settings - Flexible layout */}
              <div className="flex flex-wrap justify-center bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-full p-1 border border-white/20 shadow-2xl items-center gap-0.5 md:gap-2">
                {/* Music Control */}
                <button
                  onClick={toggleMusic}
                  className="flex items-center justify-center w-7 sm:w-8 h-8 md:w-10 md:h-10 rounded-full text-white hover:bg-white/10 transition-all"
                  title={isMusicPlaying ? "Хөгжим зогсоох" : "Хөгжим тоглуулах"}
                >
                  {isMusicPlaying ? <Music className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                </button>

                <div className="hidden md:block w-px h-4 bg-white/10 mx-1"></div>

                {/* Input Control Toggle */}
                <div className="flex shrink-0 bg-white/5 rounded-full p-0.5">
                  <button
                    onClick={() => setControlMode(ControlMode.MOUSE)}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 rounded-full transition-all ${controlMode === ControlMode.MOUSE ? 'bg-white text-black shadow-lg' : 'text-white hover:bg-white/10'
                      }`}
                  >
                    <Mouse className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[11px] md:text-xs font-medium">{isMobile ? 'Хуруу' : 'Хулгана'}</span>
                  </button>
                  <button
                    onClick={() => setControlMode(ControlMode.HAND)}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 rounded-full transition-all ${controlMode === ControlMode.HAND ? 'bg-[#1cbd62] text-white shadow-lg' : 'text-white hover:bg-white/10'
                      }`}
                  >
                    <Hand className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[11px] md:text-xs font-medium">Гар</span>
                  </button>
                </div>

                <div className="hidden md:block w-px h-4 bg-white/10 mx-1"></div>

                {/* Interaction Mode Toggle */}
                <div className="flex shrink-0 bg-white/5 rounded-full p-0.5">
                  <button
                    onClick={() => setInteractionMode(InteractionMode.VIEW)}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 rounded-full transition-all ${interactionMode === InteractionMode.VIEW ? 'bg-[#f2e24e] text-black shadow-lg' : 'text-white hover:bg-white/10'
                      }`}
                  >
                    <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[11px] md:text-xs font-medium">Харах</span>
                  </button>
                  <button
                    onClick={() => setInteractionMode(InteractionMode.EDIT)}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 rounded-full transition-all ${interactionMode === InteractionMode.EDIT ? 'bg-[#ff421c] text-white shadow-lg' : 'text-white hover:bg-white/10'
                      }`}
                  >
                    <Edit3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[11px] md:text-xs font-medium">Засах</span>
                  </button>
                </div>

                <div className="hidden md:block w-px h-4 bg-white/10 mx-1"></div>

                {/* Window Controls */}
                <div className="flex gap-0.5 md:gap-1">
                  {canFullscreen && !isMobile && (
                    <button
                      onClick={toggleFullscreen}
                      className="hidden lg:flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-white hover:bg-white/10 transition-all"
                      title="Бүтэн дэлгэц"
                    >
                      <Maximize className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowUI(false)}
                    className="flex items-center justify-center w-7 sm:w-8 h-8 md:w-10 md:h-10 rounded-full text-white hover:bg-white/10 transition-all"
                    title="Товчнуудыг нуух"
                  >
                    <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Row: Content Actions - Wrapping for mobile */}
              <div className="flex flex-wrap justify-center bg-white/10 backdrop-blur-md rounded-2xl md:rounded-full p-1 border border-white/20 shadow-2xl items-center gap-0.5 md:gap-1 w-full max-w-fit">

                {zoomLevel === ZoomLevel.ZOOMED_IN && (
                  <div className="flex items-center gap-0.5 md:gap-1 border-r border-white/10 pr-1 mr-1">
                    <button
                      onClick={onPrev}
                      className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-white hover:bg-white/10 transition-all"
                      title="Өмнөх зураг"
                    >
                      <ChevronLeft className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                    </button>

                    <button
                      onClick={() => setZoomLevel(ZoomLevel.FULL_TREE)}
                      className="flex items-center px-2 md:px-5 py-1.5 md:py-2 rounded-full transition-all text-white hover:bg-white/10 whitespace-nowrap"
                    >
                      <span className="text-[11px] md:text-sm font-medium text-[#fff1a1]">
                        <span className="md:hidden">Буцах</span>
                        <span className="hidden md:inline">Мод руу буцах</span>
                      </span>
                    </button>

                    <button
                      onClick={onNext}
                      className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-white hover:bg-white/10 transition-all"
                      title="Дараах зураг"
                    >
                      <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                    </button>
                  </div>
                )}

                {/* Local Upload */}
                <button
                  onClick={triggerBulkUpload}
                  className="flex items-center gap-1 md:gap-2 px-2.5 md:px-5 py-1.5 md:py-2 rounded-full transition-all text-white hover:bg-white/10"
                >
                  <ImagePlus className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#f2e24e]" />
                  <span className="text-[11px] md:text-sm font-medium whitespace-nowrap text-white/90">
                    <span className="md:hidden">Нэмэх</span>
                    <span className="hidden md:inline">Зураг нэмэх</span>
                  </span>
                </button>


                <div className="w-px h-4 md:h-6 bg-white/10 mx-0.5"></div>

                {/* Video Download Dropdown */}
                <div className="relative group">
                  <button
                    onClick={() => setVideoMenuOpen(o => !o)}
                    className={`flex items-center gap-1 md:gap-2 px-2.5 md:px-5 py-1.5 md:py-2 rounded-full transition-all text-white bg-white/5 hover:bg-white/10 ${isRecording ? 'animate-pulse bg-red-500/20' : ''}`}
                    title="Бичлэг татах"
                  >
                    <Video className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isRecording ? 'text-red-500' : 'text-[#3b82f6]'}`} />
                    <span className="text-[11px] md:text-sm font-medium whitespace-nowrap text-white/90">
                      {isRecording ? 'Бичиж байна...' : 'Бичлэг'}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {!isRecording && (
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 md:w-56 bg-black/95 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden ${videoMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'} md:group-hover:opacity-100 md:group-hover:visible transition-all z-[100] shadow-[0_10px_40px_rgba(0,0,0,0.8)]`}>
                      <button
                        onClick={() => { setVideoMenuOpen(false); onRecordVideo('FULL'); }}
                        className="w-full text-left px-4 md:px-5 py-3 md:py-4 text-[10px] md:text-sm font-semibold text-white hover:bg-white/20 transition-colors border-b border-white/10 flex items-center gap-2 md:gap-3"
                      >
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                        360° эргэлт
                      </button>
                      <button
                        onClick={() => { setVideoMenuOpen(false); onRecordVideo('ALBUM'); }}
                        className="w-full text-left px-4 md:px-5 py-3 md:py-4 text-[10px] md:text-sm font-semibold text-white hover:bg-white/20 transition-colors flex items-center gap-2 md:gap-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                        Зургуудаар аялах
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-px h-4 md:h-6 bg-white/10 mx-0.5"></div>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 md:gap-2 px-2.5 md:px-5 py-1.5 md:py-2 rounded-full transition-all text-white hover:bg-white/10"
                  title="Модны зургийг татах"
                >
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#1cbd62]" />
                  <span className="text-[11px] md:text-sm font-medium whitespace-nowrap text-white/90">Зураг татах</span>
                </button>

                {/* Save & Share */}
                <button
                  onClick={onOpenShare}
                  className="flex items-center gap-1 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 ml-0.5 rounded-full transition-all text-white bg-[#1cbd62] hover:bg-[#1faa6a] shadow-[0_0_20px_rgba(28,189,98,0.35)]"
                  title="Хадгалаад холбоосоор хуваалцах"
                >
                  <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="text-[11px] md:text-sm font-semibold whitespace-nowrap">Хуваалцах</span>
                </button>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length) onBulkUpload(e.target.files);
                    e.target.value = '';
                  }}
                />

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Overlay;