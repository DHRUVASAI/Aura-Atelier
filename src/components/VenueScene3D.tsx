import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PhysicsProps } from '@react-three/cannon';
import {
  EventPreset,
  GuestRecord,
  LightingAtmosphere,
  SeatingTable,
  StageBackdropStyle,
  TableArrangementLayout,
  VenueEnvironmentMode,
} from '../types/planning';
import {
  CanonicalLightingAtmosphere,
  SeatingSummaryMetrics,
  computeLightingAtmosphereProfile,
  normalizeLightingAtmosphere,
} from '../utils/planningLogic';
import {
  VENUE_CANNON_CONFIG,
  VenueCannonPhysicsSimulator,
  evaluateArSpaceValidation,
} from '../utils/physicsEngine';
import { CustomSelectPopover } from './CustomSelectPopover';
import {
  MessageSquare,
  Move,
  Plus,
  Minus,
  Scan,
  ArrowDownToLine,
  ShieldCheck,
  Sun,
  Moon,
  Sunrise,
  QrCode,
} from 'lucide-react';

interface VenueScene3DProps {
  preset: EventPreset;
  tables: SeatingTable[];
  guests: GuestRecord[];
  seatingMetrics: SeatingSummaryMetrics;
  selectedTableNumber: number | null;
  onSelectTable: (tableNumber: number) => void;
  onOpenRsvpModal: () => void;
  onOpenShareSeating?: () => void;
  onOpenChat: () => void;
  onUpdatePresetSettings: (updates: Partial<EventPreset>) => void;
  onApplyTableLayout: (layout: TableArrangementLayout) => void;
  onMoveTable: (tableNumber: number, x: number, z: number) => void;
  onSyncTablesFromPhysics?: (
    updatedCoords: { tableNumber: number; x: number; z: number }[]
  ) => void;
  onAddTable: () => void;
  onRemoveTable: () => void;
}

type CameraPresetKey = 'overview' | 'headTable' | 'stage' | 'banquetFloor' | 'topDown';
type DockTabKey = 'venue' | 'tables' | 'colors' | 'camera';

const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { label: 'Overview Vista', pos: [0, 11.5, 16.5], target: [0, 1.0, 0.5] },
  headTable: { label: 'Head Table 01', pos: [0, 3.6, 1.2], target: [0, 0.9, -4.0] },
  stage: { label: 'Ceremonial Stage', pos: [4.2, 4.2, -1.8], target: [0, 1.8, -8.2] },
  banquetFloor: { label: 'Banquet Floor', pos: [-9.5, 5.2, 8.5], target: [0, 0.8, 2.0] },
  topDown: { label: 'Floor Plan', pos: [0, 22.0, 0.01], target: [0, 0, 1.0] },
};

const LINEN_SWATCHES = [
  { label: 'Ivory Silk', hex: '#F5F2EB' },
  { label: 'Emerald Green', hex: '#0F5132' },
  { label: 'Royal Crimson', hex: '#881337' },
  { label: 'Midnight Navy', hex: '#1E293B' },
  { label: 'Rose Blush', hex: '#F4ACB7' },
  { label: 'Royal Plum', hex: '#581C87' },
];

const ACCENT_SWATCHES = [
  { label: 'Royal Gold', hex: '#D4AF37' },
  { label: 'Marigold', hex: '#E09F3E' },
  { label: 'Peacock Teal', hex: '#0D9488' },
  { label: 'Rose Copper', hex: '#B56576' },
];

const FLOOR_SWATCHES = [
  { label: 'Sandstone', hex: '#EDE8DF' },
  { label: 'White Marble', hex: '#F8FAFC' },
  { label: 'Terracotta', hex: '#B45309' },
  { label: 'Obsidian Slate', hex: '#334155' },
];

function createProceduralTravertineTexture(maxAnisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F5F2EC';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 180; i++) {
    const x = (i * 73) % 512;
    const y = (i * 41) % 512;
    const w = 36 + (i % 64);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(214, 205, 190, 0.25)' : 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x, y, w, 3);
  }

  ctx.strokeStyle = 'rgba(160, 150, 136, 0.42)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let p = 0; p <= 512; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  const albedoMap = new THREE.CanvasTexture(canvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(6, 6);
  albedoMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(canvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 6);
  bumpMap.anisotropy = maxAnisotropy;

  return { albedoMap, bumpMap };
}

const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchEuler = new THREE.Euler();
const _scratchColor = new THREE.Color();
const _scratchVec3 = new THREE.Vector3();
const _scratchTarget = new THREE.Vector3();

export const VenueScene3D: React.FC<VenueScene3DProps> = ({
  preset,
  tables,
  seatingMetrics,
  selectedTableNumber,
  onSelectTable,
  onOpenRsvpModal,
  onOpenShareSeating,
  onOpenChat,
  onUpdatePresetSettings,
  onApplyTableLayout,
  onMoveTable,
  onSyncTablesFromPhysics,
  onAddTable,
  onRemoveTable,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cannonSimRef = useRef<VenueCannonPhysicsSimulator | null>(null);

  const [activeDockTab, setActiveDockTab] = useState<DockTabKey>('venue');
  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>('overview');
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [dragTablesMode, setDragTablesMode] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  // WebXR Augmented Reality & @react-three/cannon Physics States
  const [arModeActive, setArModeActive] = useState<boolean>(false);
  const [arScaleMode, setArScaleMode] = useState<'1:1' | '1:10'>('1:1');
  const [webXrNativeSupported, setWebXrNativeSupported] = useState<boolean>(false);
  const [arSessionStatus, setArSessionStatus] = useState<string>(
    'Calibrated Floor Projection Ready (24.0m × 18.0m)'
  );
  const [physicsEnabled, setPhysicsEnabled] = useState<boolean>(true);
  const [physicsDropCount, setPhysicsDropCount] = useState<number>(0);
  const [activeCollisionCount, setActiveCollisionCount] = useState<number>(0);

  // Canonical @react-three/cannon Physics configuration
  const cannonPhysicsProps: PhysicsProps = useMemo(
    () => ({
      gravity: VENUE_CANNON_CONFIG.gravity,
      defaultContactMaterial: VENUE_CANNON_CONFIG.defaultContactMaterial,
      allowSleep: true,
    }),
    []
  );

  // Real-world meter space validation summary for WebXR AR projection
  const arValidationSummary = useMemo(() => evaluateArSpaceValidation(tables), [tables]);

  useEffect(() => {
    const navXr = (navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }).xr;
    if (navXr && typeof navXr.isSessionSupported === 'function') {
      navXr
        .isSessionSupported('immersive-ar')
        .then((supported) => setWebXrNativeSupported(Boolean(supported)))
        .catch(() => setWebXrNativeSupported(false));
    }
  }, []);

  const environmentMode: VenueEnvironmentMode = preset.environmentMode || 'conservatory';
  const tableLayout: TableArrangementLayout = preset.tableLayout || 'banquet-radial';
  const linenColor = preset.linenColor || '#F5F2EB';
  const accentHex = preset.accentHex || '#D4AF37';
  const floorColor = preset.floorColor || '#EDE8DF';
  const stageStyle: StageBackdropStyle = preset.stageStyle || 'floral-mandap';
  const lightingMode: LightingAtmosphere = preset.lightingMode || 'sunset-warmth';
  const canonicalLighting: CanonicalLightingAtmosphere = normalizeLightingAtmosphere(lightingMode);
  const lightIntensity: number = preset.lightIntensity ?? 1.0;

  const activeLightingProfile = useMemo(
    () => computeLightingAtmosphereProfile(lightingMode, lightIntensity, environmentMode, false),
    [lightingMode, lightIntensity, environmentMode]
  );

  const stateRef = useRef({
    cameraPreset: 'overview' as CameraPresetKey,
    explodedFactor: 0,
    environmentMode,
    linenColor,
    accentHex,
    floorColor,
    stageStyle,
    lightingMode,
    lightIntensity,
    selectedTableNumber: selectedTableNumber ?? 1,
    activeCameraTransition: false,
    dragTablesMode: false,
    arModeActive: false,
    arScaleMode: '1:1' as '1:1' | '1:10',
    physicsEnabled: true,
    physicsSimulating: false,
    onSelectTable,
    onMoveTable,
    onSyncTablesFromPhysics,
  });

  stateRef.current.environmentMode = environmentMode;
  stateRef.current.linenColor = linenColor;
  stateRef.current.accentHex = accentHex;
  stateRef.current.floorColor = floorColor;
  stateRef.current.stageStyle = stageStyle;
  stateRef.current.lightingMode = lightingMode;
  stateRef.current.lightIntensity = lightIntensity;
  stateRef.current.selectedTableNumber = selectedTableNumber ?? 1;
  stateRef.current.dragTablesMode = dragTablesMode;
  stateRef.current.arModeActive = arModeActive;
  stateRef.current.arScaleMode = arScaleMode;
  stateRef.current.physicsEnabled = physicsEnabled;
  stateRef.current.onSelectTable = onSelectTable;
  stateRef.current.onMoveTable = onMoveTable;
  stateRef.current.onSyncTablesFromPhysics = onSyncTablesFromPhysics;

  const requestRenderRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Re-trigger render whenever visual props change
  useEffect(() => {
    requestRenderRef.current();
  }, [
    environmentMode,
    linenColor,
    accentHex,
    floorColor,
    stageStyle,
    lightingMode,
    lightIntensity,
    selectedTableNumber,
    explodedFactor,
    dragTablesMode,
    arModeActive,
    arScaleMode,
    physicsEnabled,
  ]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonColor = new THREE.Color('#131C2E');
    scene.background = horizonColor;
    scene.fog = new THREE.FogExp2('#131C2E', 0.016);

    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    const camera = new THREE.PerspectiveCamera(
      45,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.1,
      120
    );
    camera.position.set(0, 11.5, 16.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0.5);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 4;
    controls.maxDistance = 34;

    const hemiLight = new THREE.HemisphereLight(
      0xdbeafe,
      0x33291f,
      isSoftwareGl ? 1.15 : 0.78
    );
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    keyLight.position.set(10, 18, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 42;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    rimLight.position.set(-12, 10, -14);
    scene.add(rimLight);

    const stageAccentLight = new THREE.PointLight(0xffb76b, 1.85, 28, 1.5);
    stageAccentLight.position.set(0, 6.2, -5.5);
    scene.add(stageAccentLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { albedoMap, bumpMap } = createProceduralTravertineTexture(maxAniso);

    // Outdoor botanical lawn
    const terrainGeo = new THREE.CircleGeometry(65, 48);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x1e3528,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.position.y = -0.04;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Main Venue Terrace Floor
    const floorGeo = new THREE.BoxGeometry(24, 0.16, 26);
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(stateRef.current.floorColor),
      map: albedoMap,
      bumpMap,
      bumpScale: 0.015,
      roughness: 0.42,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.08, 0.5);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Shared Materials
    const linenMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(stateRef.current.linenColor),
      roughness: 0.82,
      metalness: 0.04,
    });
    const satinRunnerMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(stateRef.current.accentHex),
      roughness: 0.28,
      metalness: 0.35,
      clearcoat: 0.6,
    });
    const brushedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      roughness: 0.18,
      metalness: 0.92,
      anisotropy: 0.7,
    });
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d4c3b,
      roughness: 0.76,
      metalness: 0.02,
    });
    const orchidBloomMat = new THREE.MeshStandardMaterial({
      color: 0xfdfbf7,
      roughness: 0.45,
      metalness: 0.05,
    });
    const warmStoneWallMat = new THREE.MeshStandardMaterial({
      color: 0x332d28,
      roughness: 0.75,
      metalness: 0.05,
    });
    const warmBulbMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
    });
    const contactShadowGeo = new THREE.CircleGeometry(1.65, 24);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    // Ceremonial Stage Group
    const stageGroup = new THREE.Group();
    stageGroup.position.set(0, 0, -8.2);
    scene.add(stageGroup);

    const podiumBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.5, 0.36, 36),
      floorMat
    );
    podiumBase.position.y = 0.18;
    podiumBase.castShadow = true;
    podiumBase.receiveShadow = true;
    stageGroup.add(podiumBase);

    const podiumTrim = new THREE.Mesh(
      new THREE.TorusGeometry(4.22, 0.035, 12, 48),
      brushedGoldMat
    );
    podiumTrim.rotation.x = Math.PI / 2;
    podiumTrim.position.y = 0.36;
    stageGroup.add(podiumTrim);

    const colGeo = new THREE.CylinderGeometry(0.28, 0.34, 3.2, 16);
    const leftCol = new THREE.Mesh(colGeo, porcelainMat);
    leftCol.position.set(-2.6, 1.96, -0.6);
    leftCol.castShadow = true;
    stageGroup.add(leftCol);

    const rightCol = new THREE.Mesh(colGeo, porcelainMat);
    rightCol.position.set(2.6, 1.96, -0.6);
    rightCol.castShadow = true;
    stageGroup.add(rightCol);

    const archGeo = new THREE.TorusGeometry(2.6, 0.24, 16, 40, Math.PI);
    const archMesh = new THREE.Mesh(archGeo, foliageMat);
    archMesh.position.set(0, 3.4, -0.6);
    archMesh.castShadow = true;
    stageGroup.add(archMesh);

    const haloGeo = new THREE.TorusGeometry(3.05, 0.045, 14, 48, Math.PI);
    const haloMesh = new THREE.Mesh(haloGeo, brushedGoldMat);
    haloMesh.position.set(0, 3.4, -0.75);
    stageGroup.add(haloMesh);

    // Optional Royal Velvet Backdrop Curtain for Stage
    const velvetCurtainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 3.8, 0.18),
      satinRunnerMat
    );
    velvetCurtainMesh.position.set(0, 2.25, -1.25);
    stageGroup.add(velvetCurtainMesh);

    // 3-Tier Lathe Cake on Stage
    const cakePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.55, 0),
      new THREE.Vector2(0.55, 0.32),
      new THREE.Vector2(0.4, 0.32),
      new THREE.Vector2(0.4, 0.62),
      new THREE.Vector2(0.26, 0.62),
      new THREE.Vector2(0.26, 0.88),
      new THREE.Vector2(0, 0.88),
    ];
    const cakeGeo = new THREE.LatheGeometry(cakePoints, 28);
    const cakeMesh = new THREE.Mesh(cakeGeo, porcelainMat);
    cakeMesh.position.set(0, 1.15, 0.4);
    cakeMesh.castShadow = true;
    stageGroup.add(cakeMesh);

    const cakePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.45, 0.78, 24),
      brushedGoldMat
    );
    cakePedestal.position.set(0, 0.75, 0.4);
    stageGroup.add(cakePedestal);

    // ENVIRONMENT LAYER GROUPS (Explodable Overhead Canopy)
    const roofCanopyGroup = new THREE.Group();
    scene.add(roofCanopyGroup);

    // A. Glasshouse Conservatory Arches
    const conservatoryGroup = new THREE.Group();
    roofCanopyGroup.add(conservatoryGroup);
    const trussArchGeo = new THREE.TorusGeometry(11.4, 0.08, 10, 48, Math.PI);
    for (let z = -8; z <= 8; z += 4) {
      const truss = new THREE.Mesh(trussArchGeo, brushedGoldMat);
      truss.position.set(0, 0, z);
      conservatoryGroup.add(truss);
    }

    // B. Indoor Grand Ballroom Walls, Columns & Chandeliers
    const indoorGroup = new THREE.Group();
    roofCanopyGroup.add(indoorGroup);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 9.5, 0.4), warmStoneWallMat);
    backWall.position.set(0, 4.75, -12.3);
    indoorGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 26), warmStoneWallMat);
    leftWall.position.set(-11.8, 4.75, 0.5);
    indoorGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 26), warmStoneWallMat);
    rightWall.position.set(11.8, 4.75, 0.5);
    indoorGroup.add(rightWall);

    // Indoor Coffered Ceiling Beams & Brass Chandeliers
    for (let z = -6; z <= 6; z += 6) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(23.6, 0.35, 0.45), brushedGoldMat);
      beam.position.set(0, 9.2, z);
      indoorGroup.add(beam);

      const chandelierRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.06, 12, 32),
        brushedGoldMat
      );
      chandelierRing.rotation.x = Math.PI / 2;
      chandelierRing.position.set(0, 7.6, z);
      indoorGroup.add(chandelierRing);

      const chandelierGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        warmBulbMat
      );
      chandelierGlow.position.set(0, 7.6, z);
      indoorGroup.add(chandelierGlow);
    }

    // C. Outdoor Garden Festoon String Lights & Corner Timber Posts
    const outdoorGroup = new THREE.Group();
    roofCanopyGroup.add(outdoorGroup);
    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 12);
    const postCoords: [number, number][] = [
      [-10.5, -9],
      [10.5, -9],
      [-10.5, 9],
      [10.5, 9],
    ];
    postCoords.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, brushedGoldMat);
      post.position.set(px, 2.8, pz);
      outdoorGroup.add(post);
    });
    const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
    for (let row = -6; row <= 6; row += 6) {
      for (let bx = -9; bx <= 9; bx += 2.25) {
        const sag = Math.cos((bx / 10) * (Math.PI / 2)) * 0.65;
        const bulb = new THREE.Mesh(bulbGeo, warmBulbMat);
        bulb.position.set(bx, 5.4 - sag, row);
        outdoorGroup.add(bulb);
      }
    }

    // D. WebXR Augmented Reality Real-World Space Validation Group (24m x 18m Calibration Grid + Hit-Test Reticle)
    const arValidationGroup = new THREE.Group();
    arValidationGroup.visible = false;
    scene.add(arValidationGroup);

    const arGridHelper = new THREE.GridHelper(24, 24, 0x10b981, 0x059669);
    arGridHelper.position.set(0, 0.03, 0.5);
    arValidationGroup.add(arGridHelper);

    const arBoundaryGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(24, 0.12, 18));
    const arBoundaryLines = new THREE.LineSegments(
      arBoundaryGeo,
      new THREE.LineBasicMaterial({ color: 0x34d399 })
    );
    arBoundaryLines.position.set(0, 0.06, 0.8);
    arValidationGroup.add(arBoundaryLines);

    // WebXR Surface Hit-Test Reticle at Floor Anchor
    const reticleOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 36),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    reticleOuter.rotation.x = -Math.PI / 2;
    reticleOuter.position.set(0, 0.04, 1.0);
    arValidationGroup.add(reticleOuter);

    const reticleInner = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    reticleInner.rotation.x = -Math.PI / 2;
    reticleInner.position.set(0, 0.045, 1.0);
    arValidationGroup.add(reticleInner);

    // Initialize @react-three/cannon + cannon-es Rigid Body Physics World
    const cannonSim = new VenueCannonPhysicsSimulator(tables, 0);
    cannonSimRef.current = cannonSim;

    // Composite Banquet Tables + Raycast Proxies
    const interactableProxies: THREE.Mesh[] = [];
    const tableGroups: {
      group: THREE.Group;
      topGroup: THREE.Group;
      centerpieceGroup: THREE.Group;
      selectionRing: THREE.Mesh;
      arClearanceRing: THREE.Mesh;
      tableNumber: number;
    }[] = [];

    const tablePedestalGeo = new THREE.CylinderGeometry(0.22, 0.48, 0.74, 20);
    const tableLinenGeo = new THREE.CylinderGeometry(1.38, 1.48, 0.78, 32);
    const tableRunnerGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.03, 28);
    const vaseGeo = new THREE.CylinderGeometry(0.14, 0.09, 0.42, 16);
    const floralDomeGeo = new THREE.SphereGeometry(0.38, 16, 12);
    const ringGeo = new THREE.RingGeometry(1.58, 1.78, 36);
    const arClearanceRingGeo = new THREE.RingGeometry(1.95, 2.70, 40);

    tables.forEach((tbl) => {
      const group = new THREE.Group();
      group.position.set(tbl.x, 0, tbl.z);
      scene.add(group);

      const shadowDisc = new THREE.Mesh(contactShadowGeo, contactShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.015;
      group.add(shadowDisc);

      const selMat = new THREE.MeshBasicMaterial({
        color: 0xc89d54,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: tbl.tableNumber === stateRef.current.selectedTableNumber ? 0.95 : 0.22,
      });
      const selectionRing = new THREE.Mesh(ringGeo, selMat);
      selectionRing.rotation.x = -Math.PI / 2;
      selectionRing.position.y = 0.025;
      group.add(selectionRing);

      // 1.5m AR Service Corridor Clearance Ring around every table
      const arClearanceMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28,
      });
      const arClearanceRing = new THREE.Mesh(arClearanceRingGeo, arClearanceMat);
      arClearanceRing.rotation.x = -Math.PI / 2;
      arClearanceRing.position.y = 0.022;
      arClearanceRing.visible = false;
      group.add(arClearanceRing);

      const pedestal = new THREE.Mesh(tablePedestalGeo, brushedGoldMat);
      pedestal.position.y = 0.37;
      group.add(pedestal);

      const topGroup = new THREE.Group();
      group.add(topGroup);

      const linenMesh = new THREE.Mesh(tableLinenGeo, linenMat);
      linenMesh.position.y = 0.41;
      linenMesh.castShadow = true;
      linenMesh.receiveShadow = true;
      topGroup.add(linenMesh);

      const runnerMesh = new THREE.Mesh(tableRunnerGeo, satinRunnerMat);
      runnerMesh.position.y = 0.81;
      topGroup.add(runnerMesh);

      const centerpieceGroup = new THREE.Group();
      group.add(centerpieceGroup);

      const vaseMesh = new THREE.Mesh(vaseGeo, brushedGoldMat);
      vaseMesh.position.y = 1.02;
      centerpieceGroup.add(vaseMesh);

      const floralDome = new THREE.Mesh(floralDomeGeo, orchidBloomMat);
      floralDome.scale.set(1.15, 0.75, 1.15);
      floralDome.position.y = 1.32;
      floralDome.castShadow = true;
      centerpieceGroup.add(floralDome);

      const proxyMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.65, 1.65, 1.5, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxyMesh.position.y = 0.75;
      proxyMesh.userData = { tableNumber: tbl.tableNumber };
      group.add(proxyMesh);
      interactableProxies.push(proxyMesh);

      tableGroups.push({
        group,
        topGroup,
        centerpieceGroup,
        selectionRing,
        arClearanceRing,
        tableNumber: tbl.tableNumber,
      });
    });

    // InstancedMesh for Chairs & Plates
    const totalChairs = Math.max(1, tables.length * 8);
    const chairSeatGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.46, 14);
    const chairBackGeo = new THREE.BoxGeometry(0.42, 0.48, 0.06);
    const plateGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.02, 16);

    const chairSeatsInstanced = new THREE.InstancedMesh(
      chairSeatGeo,
      brushedGoldMat,
      totalChairs
    );
    const chairBacksInstanced = new THREE.InstancedMesh(chairBackGeo, linenMat, totalChairs);
    const platesInstanced = new THREE.InstancedMesh(plateGeo, porcelainMat, totalChairs);

    chairSeatsInstanced.castShadow = !isSoftwareGl;
    chairBacksInstanced.castShadow = !isSoftwareGl;

    function rebuildChairInstances(yOffsets?: Map<number, number>) {
      let idx = 0;
      tables.forEach((tbl) => {
        const tg = tableGroups.find((g) => g.tableNumber === tbl.tableNumber);
        const tx = tg ? tg.group.position.x : tbl.x;
        const tz = tg ? tg.group.position.z : tbl.z;
        const ty = yOffsets?.get(tbl.tableNumber) ?? (tg ? tg.group.position.y : 0);

        for (let s = 0; s < 8; s++) {
          const angle = (s / 8) * Math.PI * 2;
          const chairRadius = 1.88;
          const cx = tx + Math.cos(angle) * chairRadius;
          const cz = tz + Math.sin(angle) * chairRadius;

          _scratchPos.set(cx, ty + 0.23, cz);
          _scratchEuler.set(0, -angle + Math.PI / 2, 0);
          _scratchQuat.setFromEuler(_scratchEuler);
          _scratchScale.set(1, 1, 1);
          _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
          chairSeatsInstanced.setMatrixAt(idx, _scratchMat4);

          _scratchPos.set(
            tx + Math.cos(angle) * (chairRadius + 0.19),
            ty + 0.66,
            tz + Math.sin(angle) * (chairRadius + 0.19)
          );
          _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
          chairBacksInstanced.setMatrixAt(idx, _scratchMat4);

          _scratchPos.set(
            tx + Math.cos(angle) * 1.15,
            ty + 0.83,
            tz + Math.sin(angle) * 1.15
          );
          _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
          platesInstanced.setMatrixAt(idx, _scratchMat4);

          idx++;
        }
      });
      chairSeatsInstanced.instanceMatrix.needsUpdate = true;
      chairBacksInstanced.instanceMatrix.needsUpdate = true;
      platesInstanced.instanceMatrix.needsUpdate = true;
      chairSeatsInstanced.computeBoundingSphere();
      chairBacksInstanced.computeBoundingSphere();
      platesInstanced.computeBoundingSphere();
    }

    rebuildChairInstances();
    scene.add(chairSeatsInstanced);
    scene.add(chairBacksInstanced);
    scene.add(platesInstanced);

    // Outdoor Perimeter Cypress Trees (InstancedMesh > 20 items)
    const treeCount = 28;
    const treeCanopyGeo = new THREE.ConeGeometry(0.95, 3.6, 12);
    const treeInstanced = new THREE.InstancedMesh(treeCanopyGeo, foliageMat, treeCount);
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 16.5 + (i % 3) * 1.8;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const scaleVar = 0.88 + ((i * 17) % 28) / 100;
      _scratchPos.set(tx, 1.8 * scaleVar, tz);
      _scratchEuler.set(0, angle, 0);
      _scratchQuat.setFromEuler(_scratchEuler);
      _scratchScale.set(scaleVar, scaleVar, scaleVar);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      treeInstanced.setMatrixAt(i, _scratchMat4);

      _scratchColor.setHSL(0.38, 0.32, 0.18 + (i % 4) * 0.03);
      treeInstanced.setColorAt(i, _scratchColor);
    }
    treeInstanced.instanceMatrix.needsUpdate = true;
    if (treeInstanced.instanceColor) treeInstanced.instanceColor.needsUpdate = true;
    treeInstanced.computeBoundingSphere();
    scene.add(treeInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function applySceneStateAndRender(dt: number): boolean {
      let needsMoreFrames = false;

      // Update colors
      linenMat.color.set(stateRef.current.linenColor);
      satinRunnerMat.color.set(stateRef.current.accentHex);
      floorMat.color.set(stateRef.current.floorColor);

      // Update environment visibility (Outdoor vs Indoor vs Glasshouse Conservatory)
      const env = stateRef.current.environmentMode;
      const isAr = stateRef.current.arModeActive;
      conservatoryGroup.visible = env === 'conservatory' && !isAr;
      indoorGroup.visible = env === 'indoor' && !isAr;
      outdoorGroup.visible = env === 'outdoor' && !isAr;
      treeInstanced.visible = env !== 'indoor' && !isAr;
      terrainMesh.visible = !isAr;
      arValidationGroup.visible = isAr;

      // AR 1:1 vs 1:10 Tabletop Scale Projection
      const targetScale = isAr && stateRef.current.arScaleMode === '1:10' ? 0.55 : 1.0;
      scene.scale.setScalar(THREE.MathUtils.damp(scene.scale.x, targetScale, 8, dt));

      // Update stage backdrop style
      const stStyle = stateRef.current.stageStyle;
      velvetCurtainMesh.visible = stStyle === 'royal-velvet';
      archMesh.visible = stStyle !== 'minimal-arch';

      // Update lighting atmosphere & light intensity controls ('Sunset Warmth', 'Midnight Gala', 'Daylight Crisp')
      const lm = stateRef.current.lightingMode;
      const intensityMult = stateRef.current.lightIntensity ?? 1.0;
      const lightProfile = computeLightingAtmosphereProfile(lm, intensityMult, env, isSoftwareGl);

      if (isAr) {
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = Number((2.35 * intensityMult).toFixed(2));
        hemiLight.intensity = Number((1.25 * intensityMult).toFixed(2));
        rimLight.intensity = Number((0.95 * intensityMult).toFixed(2));
        stageAccentLight.intensity = Number((1.4 * intensityMult).toFixed(2));
        horizonColor.set('#06121A');
        floorMat.opacity = 0.72;
        floorMat.transparent = true;
      } else {
        floorMat.opacity = 1.0;
        floorMat.transparent = false;
        keyLight.color.setHex(lightProfile.keyLightHex);
        keyLight.intensity = lightProfile.keyLightIntensity;
        hemiLight.color.setHex(lightProfile.hemiSkyHex);
        hemiLight.groundColor.setHex(lightProfile.hemiGroundHex);
        hemiLight.intensity = lightProfile.hemiLightIntensity;
        rimLight.color.setHex(lightProfile.rimLightHex);
        rimLight.intensity = lightProfile.rimLightIntensity;
        stageAccentLight.color.setHex(lightProfile.stageAccentHex);
        stageAccentLight.intensity = lightProfile.stageAccentIntensity;
        warmBulbMat.color.setHex(lightProfile.bulbHex);
        renderer.toneMappingExposure = lightProfile.toneMappingExposure;
        horizonColor.set(lightProfile.horizonHex);
      }
      scene.background = horizonColor;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(horizonColor);
      }

      // Step @react-three/cannon + cannon-es rigid-body physics world when active
      let collidingTableSet = new Set<number>();
      if (stateRef.current.physicsEnabled && cannonSimRef.current) {
        const simResult = cannonSimRef.current.step(dt);
        const yOffsets = new Map<number, number>();
        let collisionCounter = 0;

        simResult.states.forEach((st) => {
          const tg = tableGroups.find((g) => g.tableNumber === st.tableNumber);
          if (tg) {
            tg.group.position.set(st.x, st.y, st.z);
          }
          yOffsets.set(st.tableNumber, st.y);
          if (st.isColliding) {
            collidingTableSet.add(st.tableNumber);
            collisionCounter++;
          }
        });

        rebuildChairInstances(yOffsets);

        if (simResult.isSimulating || stateRef.current.physicsSimulating) {
          needsMoreFrames = true;
          stateRef.current.physicsSimulating = simResult.isSimulating;
        }
        setActiveCollisionCount(collisionCounter);
      }

      // Evaluate real-world AR clearance per table
      const liveArSummary = evaluateArSpaceValidation(
        tableGroups.map((tg) => ({
          tableNumber: tg.tableNumber,
          label: `Table ${tg.tableNumber}`,
          capacity: 8,
          zone: 'VIP Garden',
          x: tg.group.position.x,
          z: tg.group.position.z,
        }))
      );

      // Exploded View Layer Separation
      const targetExplode = stateRef.current.explodedFactor;
      const currentRoofY = roofCanopyGroup.position.y;
      const nextRoofY = THREE.MathUtils.damp(currentRoofY, targetExplode * 5.2, 8, dt);
      roofCanopyGroup.position.y = nextRoofY;
      if (Math.abs(nextRoofY - targetExplode * 5.2) > 0.01) {
        needsMoreFrames = true;
      }

      tableGroups.forEach((tg) => {
        tg.topGroup.position.y = THREE.MathUtils.damp(
          tg.topGroup.position.y,
          targetExplode * 1.1,
          8,
          dt
        );
        tg.centerpieceGroup.position.y = THREE.MathUtils.damp(
          tg.centerpieceGroup.position.y,
          targetExplode * 2.4,
          8,
          dt
        );
        const isSelected = tg.tableNumber === stateRef.current.selectedTableNumber;
        const isColliding = collidingTableSet.has(tg.tableNumber);
        const mat = tg.selectionRing.material as THREE.MeshBasicMaterial;
        mat.opacity = isColliding ? 0.98 : isSelected ? 0.95 : 0.22;
        mat.color.set(
          isColliding ? '#EF4444' : isSelected ? '#10B981' : stateRef.current.accentHex
        );

        // Update 1.5m AR Service Corridor Clearance Ring visibility & validation color
        tg.arClearanceRing.visible = isAr;
        if (isAr) {
          const tableStatus =
            liveArSummary.perTableClearance[tg.tableNumber]?.status || 'valid';
          const arMat = tg.arClearanceRing.material as THREE.MeshBasicMaterial;
          arMat.color.set(
            tableStatus === 'collision'
              ? '#EF4444'
              : tableStatus === 'tight'
              ? '#F59E0B'
              : '#10B981'
          );
          arMat.opacity = isSelected ? 0.52 : 0.28;
        }
      });

      if (stateRef.current.activeCameraTransition) {
        const presetSpec = CAMERA_PRESETS[stateRef.current.cameraPreset];
        _scratchVec3.set(...presetSpec.pos);
        _scratchTarget.set(...presetSpec.target);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _scratchVec3.x, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _scratchVec3.y, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _scratchVec3.z, 6, dt);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _scratchTarget.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _scratchTarget.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _scratchTarget.z, 6, dt);

        if (
          camera.position.distanceTo(_scratchVec3) < 0.08 &&
          controls.target.distanceTo(_scratchTarget) < 0.08
        ) {
          stateRef.current.activeCameraTransition = false;
        } else {
          needsMoreFrames = true;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      return needsMoreFrames;
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.1) || 0.016;
        const needsMoreFrames = applySceneStateAndRender(dt);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;

    const handleControlStart = () => {
      stateRef.current.activeCameraTransition = false;
    };
    const handleControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);

    // Raycasting for Table Selection AND Physics-Driven Floor Dragging
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragIntersectPoint = new THREE.Vector3();
    let draggingTableNumber: number | null = null;

    const updatePointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (e: MouseEvent) => {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactableProxies, false);
      if (hits.length > 0) {
        const hitTable = hits[0].object.userData?.tableNumber;
        if (typeof hitTable === 'number') {
          stateRef.current.onSelectTable(hitTable);
          if (stateRef.current.dragTablesMode) {
            draggingTableNumber = hitTable;
            controls.enabled = false;
          }
          requestRender();
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (draggingTableNumber === null) return;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(floorDragPlane, dragIntersectPoint)) {
        const clampedX = Math.max(-9.2, Math.min(9.2, Number(dragIntersectPoint.x.toFixed(2))));
        const clampedZ = Math.max(-4.5, Math.min(9.2, Number(dragIntersectPoint.z.toFixed(2))));

        if (stateRef.current.physicsEnabled && cannonSimRef.current) {
          cannonSimRef.current.moveTableWithPhysics(draggingTableNumber, clampedX, clampedZ);
          stateRef.current.physicsSimulating = true;
        } else {
          const tg = tableGroups.find((item) => item.tableNumber === draggingTableNumber);
          if (tg) {
            tg.group.position.set(clampedX, 0, clampedZ);
          }
          const tblObj = tables.find((t) => t.tableNumber === draggingTableNumber);
          if (tblObj) {
            tblObj.x = clampedX;
            tblObj.z = clampedZ;
            rebuildChairInstances();
          }
        }
        requestRender();
      }
    };

    const handlePointerUp = () => {
      if (draggingTableNumber !== null) {
        if (stateRef.current.physicsEnabled && stateRef.current.onSyncTablesFromPhysics) {
          const updatedCoords = tableGroups.map((item) => ({
            tableNumber: item.tableNumber,
            x: Number(item.group.position.x.toFixed(2)),
            z: Number(item.group.position.z.toFixed(2)),
          }));
          stateRef.current.onSyncTablesFromPhysics(updatedCoords);
        } else {
          const tg = tableGroups.find((item) => item.tableNumber === draggingTableNumber);
          if (tg) {
            stateRef.current.onMoveTable(
              draggingTableNumber,
              Number(tg.group.position.x.toFixed(2)),
              Number(tg.group.position.z.toFixed(2))
            );
          }
        }
        draggingTableNumber = null;
        controls.enabled = true;
      }
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    // Synchronous initial frame render so scene is immediately painted on mount
    applySceneStateAndRender(0.016);
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      controls.dispose();
      renderer.dispose();
    };
  }, [tables]);

  const handleCameraPresetChange = (key: CameraPresetKey) => {
    setCameraPreset(key);
    stateRef.current.cameraPreset = key;
    stateRef.current.activeCameraTransition = true;
    requestRenderRef.current();
  };

  // Trigger gravity-based object drop placement via @react-three/cannon & cannon-es
  const handleTriggerGravityDrop = () => {
    if (!cannonSimRef.current) return;
    setPhysicsEnabled(true);
    stateRef.current.physicsEnabled = true;
    cannonSimRef.current.triggerGravityDropPlacement(3.8);
    stateRef.current.physicsSimulating = true;
    setPhysicsDropCount((prev) => prev + 1);
    requestRenderRef.current();
  };

  // Toggle WebXR Augmented Reality Real-World Space Validation Mode
  const handleToggleWebXrAr = async () => {
    const nextState = !arModeActive;
    setArModeActive(nextState);
    stateRef.current.arModeActive = nextState;

    if (nextState) {
      // Attempt native WebXR immersive-ar session if hardware is available, with seamless 3D floor-plan AR projection
      const navXr = (
        navigator as Navigator & {
          xr?: {
            isSessionSupported?: (mode: string) => Promise<boolean>;
            requestSession?: (mode: string, init?: Record<string, unknown>) => Promise<unknown>;
          };
        }
      ).xr;
      if (navXr && webXrNativeSupported && typeof navXr.requestSession === 'function') {
        try {
          const session = await navXr.requestSession('immersive-ar', {
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['hit-test', 'dom-overlay'],
            domOverlay: canvasMountRef.current ? { root: canvasMountRef.current } : undefined,
          });
          if (rendererRef.current && session) {
            await (
              rendererRef.current.xr as unknown as { setSession: (s: unknown) => Promise<void> }
            ).setSession(session);
            setArSessionStatus('WebXR Immersive-AR Hardware Session Active (1:1 Room Projection)');
          }
        } catch {
          setArSessionStatus('WebXR Floor-Plan Calibration Active · 24.0m × 18.0m Space Validation');
        }
      } else {
        setArSessionStatus('WebXR Floor-Plan Calibration Active · 24.0m × 18.0m Space Validation');
      }
    } else {
      setArSessionStatus('Calibrated Floor Projection Ready (24.0m × 18.0m)');
    }
    requestRenderRef.current();
  };

  const activeTable =
    tables.find((t) => t.tableNumber === selectedTableNumber) || tables[0];
  const activeTableStats = seatingMetrics.tableOccupancy[activeTable.tableNumber] || {
    occupied: 0,
    capacity: activeTable.capacity,
    guests: [],
  };

  return (
    <div
      className="relative w-full h-[calc(100vh-108px)] min-h-[560px] overflow-hidden bg-slate-950 select-none"
      data-testid="venue-3d-viewport"
      data-selected-table={activeTable.tableNumber}
      data-environment-mode={environmentMode}
      data-lighting-atmosphere={activeLightingProfile.label}
      data-light-intensity={activeLightingProfile.intensityPercent}
      data-ar-active={arModeActive ? 'true' : 'false'}
      data-physics-engine="react-three-cannon"
      data-physics-gravity={cannonPhysicsProps.gravity?.[1] ?? -9.82}
      data-physics-drops={physicsDropCount}
    >
      {/* Isolated WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Clean Top-Left Bar: Selected Table + Quick Actions + WebXR AR & Physics Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0F172A]/95 border border-slate-700/80 text-slate-100 pointer-events-auto max-w-[94vw]">
        <div className="text-xs">
          <span className="text-slate-400">
            {environmentMode === 'outdoor'
              ? 'Outdoor Starlit Garden'
              : environmentMode === 'indoor'
              ? 'Indoor Grand Ballroom'
              : 'Glasshouse Conservatory'}{' '}
            ·{' '}
          </span>
          <strong className="text-white">{activeTable.label}</strong>
          <span className="text-amber-400 font-mono ml-1.5">
            ({activeTableStats.occupied}/{activeTable.capacity} Seated)
          </span>
        </div>

        <CustomSelectPopover
          ariaLabel="Select Banquet Table"
          value={String(activeTable.tableNumber)}
          variant="dark"
          options={tables.map((t) => {
            const occ = seatingMetrics.tableOccupancy[t.tableNumber]?.occupied || 0;
            return {
              value: String(t.tableNumber),
              label: `Table ${t.tableNumber < 10 ? `0${t.tableNumber}` : t.tableNumber}`,
              badge: `${occ}/${t.capacity}`,
            };
          })}
          onChange={(val) => {
            const num = Number(val);
            onSelectTable(num);
            requestRenderRef.current();
          }}
        />

        {/* Augmented Reality (WebXR) Space Validation Toggle */}
        <button
          type="button"
          data-testid="toggle-webxr-ar-btn"
          onClick={handleToggleWebXrAr}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
            arModeActive
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-900 text-emerald-300 border-emerald-500/40 hover:bg-slate-800'
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          <span>{arModeActive ? 'Exit AR Space View' : 'AR Space Validator (WebXR)'}</span>
        </button>

        {/* Gravity Drop Placement Trigger (@react-three/cannon) */}
        <button
          type="button"
          data-testid="trigger-gravity-drop-btn"
          onClick={handleTriggerGravityDrop}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-sky-300 border border-sky-500/40 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Drop tables under -9.82 m/s² gravity with realistic floor bounce & collision resolution"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Gravity Drop</span>
        </button>

        <button
          type="button"
          onClick={onOpenRsvpModal}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors cursor-pointer"
        >
          Seat Guests ({seatingMetrics.unassignedHeadcount} Unseated)
        </button>

        {/* Share Seating Guest QR & Mobile Zone Map Button */}
        <button
          type="button"
          data-testid="open-share-seating-btn"
          onClick={() => {
            if (onOpenShareSeating) onOpenShareSeating();
            else onOpenRsvpModal();
          }}
          className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/50 rounded-lg hover:bg-indigo-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <QrCode className="w-3.5 h-3.5 text-indigo-300" />
          <span>Share Seating QR</span>
        </button>

        <button
          type="button"
          onClick={onOpenChat}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-amber-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Edit Venue via Chat</span>
        </button>
      </div>

      {/* Live WebXR Augmented Reality Space Validation Banner (Shown when AR mode is active) */}
      {arModeActive && (
        <div
          data-testid="webxr-ar-validation-panel"
          className="absolute top-20 left-4 z-10 flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl bg-emerald-950/95 border border-emerald-500/60 text-emerald-100 pointer-events-auto max-w-[94vw] text-xs shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-white">{arSessionStatus}</div>
              <div className="text-[11px] text-emerald-300 font-mono">
                Footprint: {arValidationSummary.footprintWidthMeters.toFixed(1)}m ×{' '}
                {arValidationSummary.footprintDepthMeters.toFixed(1)}m (
                {arValidationSummary.footprintAreaSqMeters} m²) · Min Aisle Clearance:{' '}
                {arValidationSummary.minClearanceMeters.toFixed(2)}m · Status:{' '}
                {arValidationSummary.validationStatus}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-emerald-300 font-medium">AR Scale:</span>
            {(['1:1', '1:10'] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setArScaleMode(sc)}
                className={`px-2.5 py-1 rounded-md font-mono font-semibold cursor-pointer ${
                  arScaleMode === sc
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800'
                }`}
              >
                {sc === '1:1' ? '1:1 Room Scale' : '1:10 Tabletop'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progressive, User-Friendly Bottom Control Dock (4 Clean Tabs — Zero Info Dump) */}
      <div className="fixed sm:absolute bottom-3 left-0 right-0 z-10 flex flex-col items-center pointer-events-none px-3">
        <div className="pointer-events-auto flex flex-col items-center max-w-[96vw]">
          <button
            type="button"
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="mb-1.5 px-3 py-1 rounded-t-lg bg-[#0F172A] border border-b-0 border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer"
          >
            {hudCollapsed ? '▲ Show Venue Studio Controls (H)' : '▼ Hide Controls · Cinema Mode (H)'}
          </button>

          {!hudCollapsed && (
            <div className="bg-[#0F172A]/95 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 shadow-2xl space-y-3 w-[min(920px,95vw)]">
              {/* Top Step Tabs inside the Dock */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 text-xs overflow-x-auto">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'venue', label: '1. Venue & Lighting Atmosphere' },
                      { id: 'tables', label: '2. Table Arrangement & Physics' },
                      { id: 'colors', label: '3. Colors & Stage' },
                      { id: 'camera', label: '4. Camera, AR & Layers' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDockTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        activeDockTab === tab.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                  <span>
                    {activeLightingProfile.label} ({activeLightingProfile.intensityPercent}%)
                  </span>
                  {activeCollisionCount > 0 && (
                    <span className="text-rose-400 font-semibold">
                      · {activeCollisionCount} Colliding
                    </span>
                  )}
                </div>
              </div>

              {/* TAB 1: VENUE ENVIRONMENT & LIGHTING ATMOSPHERE SWITCHER + LIGHT INTENSITY CONTROLS */}
              {activeDockTab === 'venue' && (
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Venue Style */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 font-medium">Venue Style:</span>
                      {(
                        [
                          { id: 'outdoor', label: 'Outdoor Garden' },
                          { id: 'indoor', label: 'Indoor Ballroom' },
                          { id: 'conservatory', label: 'Glasshouse' },
                        ] as const
                      ).map((env) => (
                        <button
                          key={env.id}
                          type="button"
                          onClick={() => onUpdatePresetSettings({ environmentMode: env.id })}
                          className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                            environmentMode === env.id
                              ? 'bg-emerald-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {env.label}
                        </button>
                      ))}
                    </div>

                    {/* Lighting Atmosphere Switcher ('Sunset Warmth', 'Midnight Gala', 'Daylight Crisp') */}
                    <div
                      className="flex items-center gap-1.5 flex-wrap"
                      data-testid="lighting-atmosphere-switcher"
                    >
                      <span className="text-slate-400 font-medium">Lighting Atmosphere:</span>
                      {(
                        [
                          {
                            id: 'sunset-warmth',
                            label: 'Sunset Warmth',
                            icon: Sunrise,
                            activeClass: 'bg-amber-400 text-slate-950 font-semibold',
                          },
                          {
                            id: 'midnight-gala',
                            label: 'Midnight Gala',
                            icon: Moon,
                            activeClass: 'bg-indigo-400 text-slate-950 font-semibold',
                          },
                          {
                            id: 'daylight-crisp',
                            label: 'Daylight Crisp',
                            icon: Sun,
                            activeClass: 'bg-sky-300 text-slate-950 font-semibold',
                          },
                        ] as const
                      ).map((m) => {
                        const IconComp = m.icon;
                        const isSelected = canonicalLighting === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            data-testid={`lighting-mode-${m.id}`}
                            aria-pressed={isSelected}
                            onClick={() => onUpdatePresetSettings({ lightingMode: m.id })}
                            className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? m.activeClass
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Light Intensity Controls Bar */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80"
                    data-testid="light-intensity-controls"
                  >
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="light-intensity-slider"
                        className="text-slate-400 font-medium whitespace-nowrap"
                      >
                        Light Intensity:
                      </label>
                      <button
                        type="button"
                        aria-label="Decrease light intensity"
                        onClick={() => {
                          const next = Math.max(0.4, Number((lightIntensity - 0.1).toFixed(2)));
                          onUpdatePresetSettings({ lightIntensity: next });
                        }}
                        className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        id="light-intensity-slider"
                        data-testid="light-intensity-slider"
                        type="range"
                        min={40}
                        max={200}
                        step={5}
                        value={Math.round(lightIntensity * 100)}
                        onChange={(e) => {
                          const val = Number(e.target.value) / 100;
                          onUpdatePresetSettings({ lightIntensity: val });
                        }}
                        className="w-28 sm:w-36 accent-amber-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-label="Increase light intensity"
                        onClick={() => {
                          const next = Math.min(2.0, Number((lightIntensity + 0.1).toFixed(2)));
                          onUpdatePresetSettings({ lightIntensity: next });
                        }}
                        className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span
                        data-testid="light-intensity-readout"
                        className="font-mono font-semibold text-amber-300 tabular-nums min-w-[3.2rem]"
                      >
                        {activeLightingProfile.intensityPercent}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          { label: 'Soft 65%', val: 0.65 },
                          { label: 'Balanced 100%', val: 1.0 },
                          { label: 'Radiant 150%', val: 1.5 },
                        ] as const
                      ).map((presetBtn) => (
                        <button
                          key={presetBtn.label}
                          type="button"
                          onClick={() => onUpdatePresetSettings({ lightIntensity: presetBtn.val })}
                          className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                            Math.abs(lightIntensity - presetBtn.val) < 0.03
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 font-semibold'
                              : 'bg-slate-800/80 text-slate-400 hover:text-white'
                          }`}
                        >
                          {presetBtn.label}
                        </button>
                      ))}
                      <span className="hidden md:inline-block text-[11px] font-mono text-slate-400 ml-1">
                        {activeLightingProfile.kelvinLabel} · Key {activeLightingProfile.keyLightIntensity}x
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TABLE SELF-ARRANGEMENT, CANNON PHYSICS COLLISION & ADD/REMOVE TABLES */}
              {activeDockTab === 'tables' && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-medium">Auto-Arrange:</span>
                    {(
                      [
                        { id: 'banquet-radial', label: 'Radial' },
                        { id: 'royal-u-shape', label: 'Royal U-Shape' },
                        { id: 'imperial-columns', label: 'Columns' },
                        { id: 'cabaret-cluster', label: 'Cabaret' },
                      ] as const
                    ).map((ly) => (
                      <button
                        key={ly.id}
                        type="button"
                        onClick={() => onApplyTableLayout(ly.id)}
                        className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          tableLayout === ly.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {ly.label}
                      </button>
                    ))}
                  </div>

                  {/* Toggle Direct Mouse Dragging of Tables on Floor with Cannon Collision Detection */}
                  <button
                    type="button"
                    onClick={() => setDragTablesMode((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      dragTablesMode
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>
                      {dragTablesMode
                        ? 'Physics Drag Active (Collisions Enabled)'
                        : 'Drag Tables by Hand'}
                    </span>
                  </button>

                  {/* Gravity Drop Placement Button */}
                  <button
                    type="button"
                    onClick={handleTriggerGravityDrop}
                    className="px-2.5 py-1.5 rounded-lg font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Gravity Drop</span>
                  </button>

                  {/* Add / Remove Table Count */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onRemoveTable}
                      disabled={tables.length <= 1}
                      title="Remove last table"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono px-1.5">{tables.length} Tables</span>
                    <button
                      type="button"
                      onClick={onAddTable}
                      disabled={tables.length >= 16}
                      title="Add table"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: COLORS (LINEN, RUNNER, FLOOR) & STAGE STYLE */}
              {activeDockTab === 'colors' && (
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                  {/* Linen Color Swatches + Custom Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Tablecloth:</span>
                    {LINEN_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        aria-label={`Tablecloth ${sw.label}`}
                        title={sw.label}
                        onClick={() => onUpdatePresetSettings({ linenColor: sw.hex })}
                        className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                          linenColor.toLowerCase() === sw.hex.toLowerCase()
                            ? 'border-amber-400 scale-110'
                            : 'border-slate-600'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom tablecloth color picker"
                      title="Pick any custom tablecloth color"
                      value={linenColor}
                      onChange={(e) => onUpdatePresetSettings({ linenColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                    />
                  </div>

                  {/* Accent / Runner Color Swatches + Custom Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Runner:</span>
                    {ACCENT_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        aria-label={`Runner ${sw.label}`}
                        title={sw.label}
                        onClick={() => onUpdatePresetSettings({ accentHex: sw.hex })}
                        className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                          accentHex.toLowerCase() === sw.hex.toLowerCase()
                            ? 'border-white scale-110'
                            : 'border-slate-600'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom runner color picker"
                      title="Pick any custom runner color"
                      value={accentHex}
                      onChange={(e) => onUpdatePresetSettings({ accentHex: e.target.value })}
                      className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                    />
                  </div>

                  {/* Floor Tone Swatches */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Floor:</span>
                    {FLOOR_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        aria-label={`Floor ${sw.label}`}
                        title={sw.label}
                        onClick={() => onUpdatePresetSettings({ floorColor: sw.hex })}
                        className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                          floorColor.toLowerCase() === sw.hex.toLowerCase()
                            ? 'border-amber-400 scale-110'
                            : 'border-slate-600'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>

                  {/* Stage Style */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Stage:</span>
                    {(
                      [
                        { id: 'floral-mandap', label: 'Floral Mandap' },
                        { id: 'royal-velvet', label: 'Royal Velvet' },
                        { id: 'minimal-arch', label: 'Minimal' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdatePresetSettings({ stageStyle: st.id })}
                        className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                          stageStyle === st.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: CAMERA VISTAS, WEBXR AR PROJECTION & EXPLODED VIEW SLIDER */}
              {activeDockTab === 'camera' && (
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-medium">Camera:</span>
                    {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCameraPresetChange(key)}
                        className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                          cameraPreset === key
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {CAMERA_PRESETS[key].label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="explode-slider" className="text-slate-400 font-medium">
                      Explode Roof & Layers:
                    </label>
                    <input
                      id="explode-slider"
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(explodedFactor * 100)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setExplodedFactor(val);
                        stateRef.current.explodedFactor = val;
                        requestRenderRef.current();
                      }}
                      className="w-28 accent-amber-500 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums w-9 text-right text-slate-300">
                      {Math.round(explodedFactor * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
