import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const defaultSettings = {
  cameraAngle: "axon",
  showLines: false,
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
  beam.rotation.z = 0.42;
  beam.position.set(0, 0.95, 0);
  group.add(beam);

  for (let index = 0; index < 9; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 1.35), wood);
    step.position.set(-3.1 + index * 0.78, 0.2 + index * 0.28, 0);
    step.rotation.z = 0.02;
    group.add(step);
  }

  [-1.7, 2.5].forEach((x, index) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2 + index * 0.45, 0.16), accent);
    support.position.set(x, 0.55 + index * 0.45, -0.52);
    group.add(support);
  });

  const rail = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.08, 0.1), metal);
  rail.rotation.z = 0.42;
  rail.position.set(0.3, 2.35, -0.72);
  group.add(rail);

  return group;
}

function addModelLines(object) {
  object.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }

    const edges = new THREE.EdgesGeometry(node.geometry, 34);
    const lines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x263241, transparent: true, opacity: 0.24 })
    );
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
    addModelLines(object);
  }
}

function frameObject(object, camera, controls, cameraAngle) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  object.scale.setScalar(4.8 / maxSize);

  camera.position.set(...(cameraPositions[cameraAngle] ?? cameraPositions.axon));
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

export function ModelViewer3D({ modelUrl, title, settings = defaultSettings, className = "" }) {
  const mountRef = useRef(null);
  const viewerSettings = { ...defaultSettings, ...settings };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isWhiteBackground = viewerSettings.background === "white";
    const scene = new THREE.Scene();
    scene.background = isWhiteBackground ? new THREE.Color(0xffffff) : null;
    scene.fog = new THREE.FogExp2(0xf3eee6, 0.055);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(isWhiteBackground ? 0xffffff : 0x000000, isWhiteBackground ? 1 : 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = viewerSettings.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = viewerSettings.autoRotate !== false && !reduceMotion;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 2.8;
    controls.maxDistance = 12;

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
        new THREE.ShadowMaterial({ color: 0x3f3024, opacity: 0.14 })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1.28;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    }

    let activeObject = null;

    function setSceneObject(object) {
      activeObject = object;
      applyRenderSettings(activeObject, viewerSettings);
      scene.add(activeObject);
      frameObject(activeObject, camera, controls, viewerSettings.cameraAngle);
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
  }, [modelUrl, viewerSettings.cameraAngle, viewerSettings.showLines, viewerSettings.shadows, viewerSettings.background, viewerSettings.autoRotate]);

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
