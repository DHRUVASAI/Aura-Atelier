import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  computeSimpleOpeningTimeline,
  computeVideoOpeningProgress,
  DEFAULT_GOOGLE_FLOW_VIDEO_PATH,
  GOOGLE_FLOW_PROMPTS,
} from '../utils/openingAnimationEngine';
import {
  ArrowRight,
  Check,
  Copy,
  Film,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface OpeningCinematic3DProps {
  onEnterLanding: () => void;
  onLaunch3DStudioDirectly?: () => void;
}

const _dummyParticle = new THREE.Object3D();

const IDB_NAME = 'aura_atelier_media_db';
const IDB_STORE = 'videos';
const IDB_KEY = 'google_flow_opening_mp4';
const CUSTOM_URL_STORAGE_KEY = 'aura_google_flow_video_url_v1';

function openVideoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveUploadedVideoBlob(blob: Blob): Promise<void> {
  const db = await openVideoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, IDB_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function loadUploadedVideoBlob(): Promise<Blob | null> {
  try {
    const db = await openVideoDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as Blob) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

async function clearUploadedVideoBlob(): Promise<void> {
  try {
    const db = await openVideoDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

export const OpeningCinematic3D: React.FC<OpeningCinematic3DProps> = ({
  onEnterLanding,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const phaseTextRef = useRef<HTMLSpanElement | null>(null);
  const titleContainerRef = useRef<HTMLDivElement | null>(null);
  const lightingBadgeRef = useRef<HTMLSpanElement | null>(null);

  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState<boolean>(false);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(
    DEFAULT_GOOGLE_FLOW_VIDEO_PATH
  );
  const [videoSourceLabel, setVideoSourceLabel] = useState<string>(
    'Google Flow · Botanical Glasshouse Lighting Morph (Option 3)'
  );
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  const hasExitedRef = useRef<boolean>(false);
  const isModalOpenRef = useRef<boolean>(false);
  const hasActiveVideoRef = useRef<boolean>(true);
  const onEnterRef = useRef(onEnterLanding);

  useEffect(() => {
    onEnterRef.current = onEnterLanding;
  }, [onEnterLanding]);

  useEffect(() => {
    isModalOpenRef.current = isStudioModalOpen;
  }, [isStudioModalOpen]);

  useEffect(() => {
    hasActiveVideoRef.current = Boolean(activeVideoSrc);
  }, [activeVideoSrc]);

  const triggerSmoothExit = () => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    setIsFadingOut(true);
    window.setTimeout(() => {
      onEnterRef.current();
    }, 360);
  };

  // Load saved Google Flow video from IndexedDB or localStorage URL if overridden, else keep DEFAULT_GOOGLE_FLOW_VIDEO_PATH
  useEffect(() => {
    let createdObjectUrl: string | null = null;
    let cancelled = false;

    async function resolveVideoSource() {
      const blob = await loadUploadedVideoBlob();
      if (cancelled) return;
      if (blob && blob.size > 0) {
        createdObjectUrl = URL.createObjectURL(blob);
        setActiveVideoSrc(createdObjectUrl);
        setVideoSourceLabel('Uploaded Custom Google Flow MP4 (Saved in Browser)');
        return;
      }

      const savedUrl = localStorage.getItem(CUSTOM_URL_STORAGE_KEY);
      if (savedUrl && savedUrl.trim()) {
        setActiveVideoSrc(savedUrl.trim());
        setCustomUrlInput(savedUrl.trim());
        setVideoSourceLabel('Custom Google Flow Video URL');
        return;
      }

      setActiveVideoSrc(DEFAULT_GOOGLE_FLOW_VIDEO_PATH);
      setVideoSourceLabel('Google Flow · Botanical Glasshouse Lighting Morph (Option 3)');
    }

    resolveVideoSource();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpenRef.current) {
        if (e.key === 'Escape') {
          setIsStudioModalOpen(false);
        }
        return;
      }
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        triggerSmoothExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCopyPrompt = async (id: string, promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPromptId(id);
      window.setTimeout(() => {
        setCopiedPromptId((prev) => (prev === id ? null : prev));
      }, 2200);
    } catch {
      setCopiedPromptId(id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await saveUploadedVideoBlob(file);
      localStorage.removeItem(CUSTOM_URL_STORAGE_KEY);
      const objUrl = URL.createObjectURL(file);
      setActiveVideoSrc(objUrl);
      setVideoSourceLabel(`Google Flow Video: ${file.name}`);
      setUploadStatusMsg(`Loaded "${file.name}" as your opening animation!`);
      setIsStudioModalOpen(false);
      hasExitedRef.current = false;
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setUploadStatusMsg('Could not store video file in browser storage.');
    }
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    localStorage.setItem(CUSTOM_URL_STORAGE_KEY, trimmed);
    clearUploadedVideoBlob();
    setActiveVideoSrc(trimmed);
    setVideoSourceLabel('Custom Google Flow Video URL');
    setUploadStatusMsg('Saved video URL as your opening animation.');
    setIsStudioModalOpen(false);
    hasExitedRef.current = false;
  };

  const handleResetToDefault = async () => {
    await clearUploadedVideoBlob();
    localStorage.removeItem(CUSTOM_URL_STORAGE_KEY);
    setActiveVideoSrc(DEFAULT_GOOGLE_FLOW_VIDEO_PATH);
    setCustomUrlInput('');
    setVideoSourceLabel('Google Flow · Botanical Glasshouse Lighting Morph (Option 3)');
    setUploadStatusMsg('Restored default Botanical Glasshouse Google Flow video.');
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090D18');

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 2.5, 8.4);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xfffbeb, 1.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfef3c7, 0x1e293b, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 3.2);
    keyLight.position.set(6, 10, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-6, 5, -5);
    scene.add(rimLight);

    const coreWarmGlow = new THREE.PointLight(0xf59e0b, 5.0, 18);
    coreWarmGlow.position.set(0, 1.5, 1.5);
    scene.add(coreWarmGlow);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.45,
      metalness: 0.45,
      roughness: 0.28,
    });
    const ivoryStoneMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x1e293b,
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.45,
    });
    const slatePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.55,
    });
    const warmGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      metalness: 0.2,
      roughness: 0.2,
    });

    const sanctuaryGroup = new THREE.Group();
    scene.add(sanctuaryGroup);

    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.5, 0.26, 48),
      slatePlinthMat
    );
    basePlinth.position.y = -0.13;
    sanctuaryGroup.add(basePlinth);

    const innerDais = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 0.2, 36),
      ivoryStoneMat
    );
    innerDais.position.y = 0.08;
    sanctuaryGroup.add(innerDais);

    const goldPlinthRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.22, 0.06, 16, 64),
      goldMat
    );
    goldPlinthRing.rotation.x = Math.PI / 2;
    goldPlinthRing.position.y = 0.02;
    sanctuaryGroup.add(goldPlinthRing);

    const colPositions = [
      [-1.1, -1.1],
      [1.1, -1.1],
      [-1.1, 1.1],
      [1.1, 1.1],
    ];
    const colGeo = new THREE.CylinderGeometry(0.11, 0.14, 2.1, 16);
    colPositions.forEach(([x, z]) => {
      const col = new THREE.Mesh(colGeo, goldMat);
      col.position.set(x, 1.15, z);
      sanctuaryGroup.add(col);
    });

    const crownFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.18, 2.6),
      ivoryStoneMat
    );
    crownFrame.position.y = 2.25;
    sanctuaryGroup.add(crownFrame);

    const domePoints: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      domePoints.push(
        new THREE.Vector2(Math.sin((1 - t) * (Math.PI / 2)) * 1.32, t * 0.95)
      );
    }
    const domeMesh = new THREE.Mesh(
      new THREE.LatheGeometry(domePoints, 32),
      goldMat
    );
    domeMesh.position.y = 2.34;
    sanctuaryGroup.add(domeMesh);

    const finialSpire = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.45, 16),
      warmGlowMat
    );
    finialSpire.position.y = 3.45;
    sanctuaryGroup.add(finialSpire);

    const centerJewel = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      warmGlowMat
    );
    centerJewel.position.y = 1.2;
    sanctuaryGroup.add(centerJewel);

    const outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(2.55, 0.055, 16, 72),
      goldMat
    );
    outerHalo.position.y = 1.35;
    sanctuaryGroup.add(outerHalo);

    const innerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.045, 16, 64),
      warmGlowMat
    );
    innerHalo.position.y = 1.35;
    sanctuaryGroup.add(innerHalo);

    const orbitPods: THREE.Group[] = [];
    const podTopGeo = new THREE.CylinderGeometry(0.36, 0.34, 0.08, 20);
    const podPedGeo = new THREE.CylinderGeometry(0.08, 0.18, 0.3, 12);
    for (let p = 0; p < 6; p++) {
      const pod = new THREE.Group();
      const ped = new THREE.Mesh(podPedGeo, goldMat);
      ped.position.y = 0.15;
      pod.add(ped);
      const top = new THREE.Mesh(podTopGeo, ivoryStoneMat);
      top.position.y = 0.32;
      pod.add(top);
      sanctuaryGroup.add(pod);
      orbitPods.push(pod);
    }

    const moteCount = 42;
    const moteMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.07, 0),
      warmGlowMat,
      moteCount
    );
    scene.add(moteMesh);

    const DURATION_SECONDS = 3.6;
    let frameId = 0;
    let isDisposed = false;
    let activeElapsed = 0;
    let lastTimestamp = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 70);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 70);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      // Only advance fallback timeline timer if modal is closed and no custom video is driving playback
      if (!isModalOpenRef.current && !hasActiveVideoRef.current) {
        activeElapsed += dt;
      }

      const tState = computeSimpleOpeningTimeline(activeElapsed, DURATION_SECONDS);

      sanctuaryGroup.position.y = tState.archRiseY;
      sanctuaryGroup.rotation.y = activeElapsed * 0.32;

      centerJewel.rotation.y = activeElapsed * 1.8;
      centerJewel.position.y = 1.2 + Math.sin(activeElapsed * 2.5) * 0.1;

      outerHalo.rotation.x = Math.PI / 2.8 + Math.sin(activeElapsed * 0.9) * 0.22;
      outerHalo.rotation.y = activeElapsed * 0.5;
      outerHalo.scale.setScalar(tState.ringScale);

      innerHalo.rotation.x = -Math.PI / 3.2 + Math.cos(activeElapsed * 1.1) * 0.25;
      innerHalo.rotation.z = -activeElapsed * 0.6;
      innerHalo.scale.setScalar(tState.ringScale);

      for (let p = 0; p < orbitPods.length; p++) {
        const a = (p / orbitPods.length) * Math.PI * 2 + activeElapsed * 0.4;
        const r = 2.65;
        orbitPods[p].position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      }

      for (let i = 0; i < moteCount; i++) {
        const angle = (i / moteCount) * Math.PI * 2 + activeElapsed * 0.3;
        const radius = 1.8 + (i % 5) * 0.55;
        const y = ((i * 0.16 + activeElapsed * 0.8) % 3.8) - 0.3;
        _dummyParticle.position.set(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius
        );
        _dummyParticle.rotation.set(activeElapsed + i, activeElapsed * 0.5, 0);
        _dummyParticle.updateMatrix();
        moteMesh.setMatrixAt(i, _dummyParticle.matrix);
      }
      moteMesh.instanceMatrix.needsUpdate = true;

      camera.position.set(0, tState.cameraY, tState.cameraZ);
      camera.lookAt(0, 1.35, 0);

      if (!hasActiveVideoRef.current) {
        if (progressFillRef.current) {
          progressFillRef.current.style.width = `${tState.progressPercent}%`;
        }
        if (phaseTextRef.current) {
          phaseTextRef.current.textContent = isModalOpenRef.current
            ? 'Paused · Configure Google Flow Intro Video'
            : tState.phaseLabel;
        }
      }

      renderer.render(scene, camera);

      if (!hasActiveVideoRef.current && !isModalOpenRef.current && tState.isComplete) {
        triggerSmoothExit();
        return;
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  const handleVideoTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const vState = computeVideoOpeningProgress(vid.currentTime, vid.duration);
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${vState.progressPercent}%`;
    }
    if (phaseTextRef.current) {
      phaseTextRef.current.textContent = vState.phaseLabel;
    }
  };

  const toggleAudioMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleContainerClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  return (
    <section
      aria-label="Aura Atelier Opening Intro"
      onClick={handleContainerClick}
      className={`fixed inset-0 z-50 select-none overflow-hidden bg-[#090D18] text-white transition-all duration-700 ease-out ${
        isFadingOut ? 'opacity-0 scale-105 blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'
      }`}
    >
      {/* Fallback 3D Canvas Backdrop when no Google Flow MP4 is active */}
      <div
        ref={canvasMountRef}
        data-testid="opening-3d-canvas"
        className={`absolute inset-0 w-full h-full ${activeVideoSrc ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      />

      {/* Full-Screen Google Flow Video Opening Player (Native video with AURA ATELIER title reveal) */}
      {activeVideoSrc && (
        <video
          ref={videoRef}
          src={activeVideoSrc}
          autoPlay
          muted={isMuted}
          playsInline
          onTimeUpdate={handleVideoTimeUpdate}
          onEnded={() => {
            if (!isModalOpenRef.current) {
              triggerSmoothExit();
            }
          }}
          onError={() => {
            setActiveVideoSrc(null);
            setUploadStatusMsg('Video could not be loaded; reverted to fallback intro.');
          }}
          data-testid="google-flow-opening-video"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Top Controls Bar (Only Skip Intro & Sound Toggle as requested) */}
      <div className="relative z-10 h-full flex flex-col justify-between p-6 sm:p-10 pointer-events-none">
        <div className="flex justify-end items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAudioMute();
            }}
            className="pointer-events-auto px-4 py-2 rounded-full text-xs font-medium text-slate-200 bg-[#090D18]/80 hover:bg-white/20 border border-white/15 backdrop-blur-md transition-colors flex items-center gap-1.5 cursor-pointer"
            aria-label={isMuted ? "Unmute Video Sound" : "Mute Video Sound"}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                <span>Tap for Sound</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Sound On</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerSmoothExit();
            }}
            className="pointer-events-auto px-4 py-2 rounded-full text-xs font-medium text-slate-200 bg-[#090D18]/80 hover:bg-white/20 border border-white/15 backdrop-blur-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Skip Intro</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>

        {/* Bottom spacer - bottom HUD removed completely */}
        <div />
      </div>

      {/* Google Flow Prompt & Video Upload Studio Modal */}
      {isStudioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Google Flow Video & Prompt Studio"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto"
        >
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-6 text-left">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
                  Google Flow (Veo) Opening Video Integration
                </span>
                <h2 className="text-xl font-bold font-display text-white mt-0.5">
                  Generate in Google Flow & Use as Opening Animation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Copy one of the tailored prompts below into Google Flow, export your MP4 clip, and upload it right here—or save it as{' '}
                  <code className="text-amber-300 font-mono">public/opening-intro.mp4</code> in your repo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudioModalOpen(false)}
                aria-label="Close Google Flow Studio"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Upload MP4 or Paste Video URL */}
            <div className="rounded-xl bg-slate-900/90 border border-amber-500/30 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Step 1 · Upload Your Generated Google Flow Video (.mp4 / .webm)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saved persistently in your browser IndexedDB so it plays automatically every time the site opens.
                  </p>
                </div>

                <label className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs cursor-pointer transition-colors inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Google Flow .MP4 File</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <form onSubmit={handleSaveCustomUrl} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="Or paste a direct .mp4 video URL (e.g. https://.../opening-intro.mp4)"
                  aria-label="Direct MP4 Video URL"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Use Video URL
                </button>
                {activeVideoSrc && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/40 text-xs text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Video</span>
                  </button>
                )}
              </form>

              {uploadStatusMsg && (
                <p className="text-xs font-mono text-emerald-400">{uploadStatusMsg}</p>
              )}
            </div>

            {/* Step 2: Ready-to-Copy Google Flow Prompts */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Step 2 · Ready-to-Copy Google Flow Prompts (16:9 Widescreen)
              </h3>

              <div className="space-y-3">
                {GOOGLE_FLOW_PROMPTS.map((item) => {
                  const isCopied = copiedPromptId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-amber-300">{item.title}</h4>
                          <p className="text-[11px] text-slate-400">
                            {item.subtitle} · <span className="font-mono text-slate-300">{item.cameraControl}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(item.id, item.prompt)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">Copied Prompt</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-amber-400" />
                              <span>Copy Prompt</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/90 p-3 rounded-lg border border-slate-800/80 select-all font-mono">
                        {item.prompt}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsStudioModalOpen(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resume Opening Intro</span>
              </button>

              <button
                type="button"
                onClick={triggerSmoothExit}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Landing Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

