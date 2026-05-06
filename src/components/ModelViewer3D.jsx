import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const defaultSettings = {
  cameraAngle: "axon",
  showLines: false,
  lineColor: "dark",
  softShadows: false,
  shadows: true,
  background: "transparent",
  autoRotate: true
};

const cameraPositions = {
  axon: [4.8, 3.2, 5.4],
  side: [6.2, 2.4, 0.25],
  front: [0.25, 2.6, 6.2],
  top: [0.25, 7.2, 0.25]
};

function makeFallbackStair() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x263241, metalness: 0.72, roughness: 0.34 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xb78654, metalness: 0.08, roughness: 0.48 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xb58455, metalness: 0.42, roughness: 0.36 });

  const beam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.26), metal);
  beam.name = "frame";
  beam.rotation.z = 0.42;
  beam.position.set(0, 0.95, 0);
  group.add(beam);

  for (let index = 0; index < 9; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 1.35), wood);
    step.name = "step";
    step.position.set(-3.1 + index * 0.78, 0.2 + index * 0.28, 0);
    step.rotation.z = 0.02;
    group.add(step);
  }

  [-1.7, 2.5].forEach((x, index) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2 + index * 0.45, 0.16), accent);
    support.name = "frame";
    support.position.set(x, 0.55 + index * 0.45, -0.52);
    group.add(support);
  });

  const rail = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.08, 0.1), metal);
  rail.name = "frame";
  rail.rotation.z = 0.42;
  rail.position.set(0.3, 2.35, -0.72);
  group.add(rail);

  return group;
}

function getLineColor(color) {
  return color === "white" ? 0xffffff : 0x2f343a;
}

function removeModelLines(object) {
  const lines = [];
  object.traverse((node) => {
    if (node.userData?.chaikaOutline) {
      lines.push(node);
    }
  });

  lines.forEach((line) => {
    line.parent?.remove(line);
    line.geometry?.dispose();
    line.material?.dispose();
  });
}

function addModelLines(object, color) {
  removeModelLines(object);
  const meshes = [];

  object.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }

    meshes.push(node);
  });

  meshes.forEach((node) => {
    const edges = new THREE.EdgesGeometry(node.geometry, 34);
    const lines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.36 })
    );
    lines.userData.chaikaOutline = true;
    node.add(lines);
  });
}

function applyRenderSettings(object, settings) {
  object.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = settings.shadows;
      node.receiveShadow = settings.shadows;
    }
  });

  if (settings.showLines) {
    addModelLines(object, getLineColor(settings.lineColor));
  } else {
    removeModelLines(object);
  }
}

function normalizeObject(object) {
  if (object.userData.chaikaFramed) {
    return;
  }

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  object.scale.setScalar(4.8 / maxSize);
  object.userData.chaikaFramed = true;
}

function frameObject(object, camera, controls, cameraAngle) {
  normalizeObject(object);

  const cameraPosition = new THREE.Vector3(...(cameraPositions[cameraAngle] ?? cameraPositions.axon));
  camera.fov = 42;
  camera.position.copy(cameraPosition);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

function getBackgroundColor(background) {
  if (background === "white") {
    return new THREE.Color(0xffffff);
  }

  return null;
}

export function ModelViewer3D({ modelUrl, title, settings = defaultSettings, className = "" }) {
  const mountRef = useRef(null);
  const activeObjectRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const viewerSettingsRef = useRef(defaultSettings);
  const viewerSettings = { ...defaultSettings, ...settings };

  viewerSettingsRef.current = viewerSettings;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const backgroundColor = getBackgroundColor(viewerSettings.background);
    const scene = new THREE.Scene();
    scene.background = backgroundColor;
    scene.fog = new THREE.FogExp2(0xf3eee6, 0.055);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setClearColor(backgroundColor || 0x000000, backgroundColor ? 1 : 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = viewerSettings.shadows;
    renderer.shadowMap.type = viewerSettings.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = viewerSettings.autoRotate !== false && !reduceMotion;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 2.8;
    controls.maxDistance = 12;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b8, 1.35));

    const mainLight = new THREE.DirectionalLight(0xfff1d2, 3.4);
    mainLight.position.set(4.8, 7.2, 5.2);
    mainLight.castShadow = viewerSettings.shadows;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 18;
    mainLight.shadow.camera.left = -6;
    mainLight.shadow.camera.right = 6;
    mainLight.shadow.camera.top = 6;
    mainLight.shadow.camera.bottom = -6;
    mainLight.shadow.radius = viewerSettings.softShadows ? 5 : 1;
    scene.add(mainLight);

    const sideLight = new THREE.DirectionalLight(0xd9ecff, 1.35);
    sideLight.position.set(-5.4, 3.2, 2.8);
    scene.add(sideLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2);
    rimLight.position.set(-3.6, 5.4, -5.2);
    scene.add(rimLight);

    if (viewerSettings.shadows) {
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 14),
        new THREE.ShadowMaterial({ color: 0x3f3024, opacity: viewerSettings.softShadows ? 0.1 : 0.14 })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1.28;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    }

    let activeObject = null;

    function setSceneObject(object) {
      activeObject = object;
      activeObjectRef.current = activeObject;
      applyRenderSettings(activeObject, viewerSettingsRef.current);
      scene.add(activeObject);
      frameObject(activeObject, camera, controls, viewerSettingsRef.current.cameraAngle);
    }

    const loader = new GLTFLoader();
    if (modelUrl) {
      loader.load(
        modelUrl,
        (gltf) => setSceneObject(gltf.scene),
        undefined,
        () => setSceneObject(makeFallbackStair())
      );
    } else {
      setSceneObject(makeFallbackStair());
    }

    let resizeFrame = 0;
    function resize() {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const width = mount.clientWidth || 1;
        const height = mount.clientHeight || 1;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    function render() {
      frame = window.requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    }
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      activeObjectRef.current = null;
      mount.removeChild(renderer.domElement);
      if (activeObject) {
        activeObject.traverse((node) => {
          if (node.geometry) {
            node.geometry?.dispose();
          }

          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose());
          } else {
            node.material?.dispose();
          }
        });
      }
    };
  }, [modelUrl, viewerSettings.shadows, viewerSettings.softShadows, viewerSettings.background, viewerSettings.autoRotate]);

  useEffect(() => {
    const activeObject = activeObjectRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const renderer = rendererRef.current;

    if (!activeObject || !camera || !controls) {
      return;
    }

    applyRenderSettings(activeObject, viewerSettings);
    frameObject(activeObject, camera, controls, viewerSettings.cameraAngle);
  }, [
    viewerSettings.cameraAngle,
    viewerSettings.showLines,
    viewerSettings.lineColor,
    viewerSettings.shadows
  ]);

  return (
    <div className={`model-viewer-shell ${className}`}>
      <div className="model-viewer-canvas" ref={mountRef} aria-label={`3D модель ${title}`} />
      <div className="model-viewer-controls" aria-label="Управление 3D моделью">
        <div className="mouse-keys" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="viewer-actions">
          <span>Вращать</span>
          <span>Масштаб</span>
          <span>Сдвиг</span>
        </div>
      </div>
    </div>
  );
}
