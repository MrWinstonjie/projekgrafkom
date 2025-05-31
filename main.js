import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

let scene, camera, renderer, model, controls;
const clock = new THREE.Clock();

let sonicModel, sonicMixer, sonicAnimationClips;
const SONIC_MODEL_PATH = "sonic_spinning/scene.gltf";

const keys = {
  W: false,
  A: false,
  S: false,
  D: false,
  SHIFT_LEFT: false,
  SPACE: false,
  E_INTERACT: false,
  G: false,
  Q_GHOST_DOWN: false,
  T: false, // Added for checkSonicVisibility
};

let isGhostMode = false;
const GHOST_MODE_SPEED_MULTIPLIER = 2.0;

const PLAYER_EYE_HEIGHT = 10.5;
const PLAYER_COLLISION_HEIGHT = 1.8;
const GRAVITY = 20.0;
const JUMP_IMPULSE = 8.0;
const MAX_STEP_HEIGHT = 0.6;
const playerRadiusBuffer = 4.0;
const PLAYER_FEET_RADIUS = playerRadiusBuffer * 0.8;
const INTERACTION_DISTANCE = 15.0;

let player = {
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  isGrounded: false,
  canJump: true,
  boundingBox: new THREE.Box3(),
};

const raycaster = new THREE.Raycaster();
const interactionRaycaster = new THREE.Raycaster();
const collidableMeshes = [];
const collidableObjectNames = [
  "Object_13108",
  "Object_13105",
  "Object_22",
  "Object_23",
  "Object_14",
  "Object_15",
  "Object_16",
  "Object_18",
  "Object_6",
  "Object_20",
  "Object_25",
  "Object_24",
];
const interactiveObjectNames = [
  "Object_13108",
  "Object_23",
  "Object_18",
  "Object_23025",
];
const collisionBoundingBoxes = new Map();

const blocker = document.getElementById("blocker");
const instructions = document.getElementById("instructions");

const _worldDirection = new THREE.Vector3();
const _movementDirection = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

let tvScreenMesh, steamObject;
let isTVOn = false;
let originalTVMaterial, staticTVMaterial;
let staticTexture;

let isSteamActive = false;
let steamAnimationTime = 0;
const STEAM_LOOP_DURATION = 2.0;
const STEAM_MAX_HEIGHT_OFFSET = 10.0;
let originalSteamPosition;
let originalSteamOpacity;

let paperMesh;
let paperPrintTexture;
let originalPaperMaterial;
let paperPrintMaterial;
let isPaperTextureVisible = false;
let paperAnimationActive = false;
let paperAnimationTime = 0;
const PAPER_ANIMATION_DURATION = 1.0;
let paperTargetOpacity = 0;
let paperCurrentOpacity = 0;

function init() {
  console.log("Init function started.");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);
  if (instructions) {
    instructions.addEventListener("click", () => controls.lock());
  }
  controls.addEventListener("lock", () => {
    if (instructions) instructions.style.display = "none";
    if (blocker) blocker.style.display = "none";
    const controlsHelp = document.getElementById("controls-help");
    if (controlsHelp) controlsHelp.style.display = "block";
  });
  controls.addEventListener("unlock", () => {
    if (blocker) blocker.style.display = "flex";
    if (instructions) instructions.style.display = "";
    const controlsHelp = document.getElementById("controls-help");
    if (controlsHelp) controlsHelp.style.display = "none";
  });
  const controlsHelp = document.getElementById("controls-help");
  if (controlsHelp) controlsHelp.style.display = "none";

  setupLighting();

  const textureLoader = new THREE.TextureLoader();
  staticTexture = textureLoader.load(
    "television.jpeg",
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      staticTVMaterial = new THREE.MeshStandardMaterial({
        map: staticTexture,
        emissiveMap: staticTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
      });
    },
    undefined,
    (error) => {
      console.error("Error loading static screen texture:", error);
      staticTVMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        emissive: 0x333333,
        emissiveIntensity: 1,
      });
    }
  );

  paperPrintTexture = textureLoader.load(
    "kertasprint.jpeg",
    (texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      paperPrintMaterial = new THREE.MeshStandardMaterial({
        map: paperPrintTexture,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
      });
    },
    undefined,
    (error) => {
      console.error("ERROR loading 'kertasprint.jpeg':", error);
      paperPrintMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
      });
    }
  );

  const loader = new GLTFLoader();
  loader.load(
    "EDGEHOG ISLAND LABOLATORY.glb",
    (gltf) => {
      console.log("Main lab model GLTF loaded.");
      model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (collidableObjectNames.includes(child.name)) {
            collidableMeshes.push(child);
            collisionBoundingBoxes.set(
              child.name,
              new THREE.Box3().setFromObject(child)
            );
          }
          if (child.name === "Object_23045") {
            paperMesh = child;
            originalPaperMaterial = paperMesh.material
              ? paperMesh.material.clone()
              : new THREE.MeshStandardMaterial({
                  color: 0xffffff,
                  roughness: 0.8,
                  metalness: 0.1,
                });
          }
        }
      });

      tvScreenMesh = model.getObjectByName("Object_13105");
      if (tvScreenMesh && tvScreenMesh.isMesh && tvScreenMesh.material) {
        originalTVMaterial = tvScreenMesh.material.clone();
      }

      steamObject = model.getObjectByName("Object_17");
      if (steamObject && steamObject.isMesh) {
        originalSteamPosition = steamObject.position.clone();
        if (steamObject.material) {
          steamObject.material.transparent = true;
          originalSteamOpacity = steamObject.material.opacity;
          steamObject.visible = false;
        }
      }

      model.scale.set(0.05, 0.05, 0.05);
      scene.add(model);

      const targetObjectName = "Object_6";
      let targetObject = model.getObjectByName(targetObjectName);
      if (targetObject) {
        const boundingBox = new THREE.Box3().setFromObject(targetObject);
        targetObject.getWorldPosition(player.position);
        player.position.y = boundingBox.max.y;
        console.log("Player initial position (on Object_6):", player.position);
      } else {
        // Mengatur Y agar player.position.y adalah dasar kaki
        player.position.set(0, PLAYER_COLLISION_HEIGHT / 2, 5);
        console.log("Player initial position (fallback):", player.position);
      }
      player.isGrounded = true;

      // Atur kamera berdasarkan posisi player (kaki) + tinggi mata
      controls.getObject().position.set(
        player.position.x,
        player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2, // Sesuaikan agar eye height relatif ke tengah collider
        player.position.z
      );

      controls.getObject().updateMatrixWorld();
      camera.updateMatrixWorld();

      player.boundingBox.setFromCenterAndSize(
        new THREE.Vector3(
          player.position.x,
          player.position.y,
          player.position.z
        ), // Bounding box berpusat di player.position
        new THREE.Vector3(
          playerRadiusBuffer * 2,
          PLAYER_COLLISION_HEIGHT,
          playerRadiusBuffer * 2
        )
      );

      loadSonicModel(); // Call the (new) loadSonicModel function

      animate();
    },
    (xhr) =>
      console.log(`Main Lab Model: ${(xhr.loaded / xhr.total) * 100}% loaded`),
    (error) => console.error("Main Lab GLTF Loading Error:", error)
  );

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize, false);
  console.log("Init function finished.");
}

// Replace your loadSonicModel function with this improved version
function loadSonicModel() {
  console.log("loadSonicModel function was called!");
  const loader = new GLTFLoader();

  // Add better error handling and debugging
  loader.load(
    SONIC_MODEL_PATH,
    (gltf) => {
      sonicModel = gltf.scene;
      sonicAnimationClips = gltf.animations;

      console.log("Sonic model loaded successfully!");
      console.log("Sonic model children:", sonicModel.children);
      console.log("Sonic animations:", sonicAnimationClips);

      // Check if the model has any meshes
      let meshCount = 0;
      sonicModel.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          console.log("Found mesh:", child.name, "Material:", child.material);

          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;

          // Fix potential material issues
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.needsUpdate = true;
              });
            } else {
              child.material.needsUpdate = true;
            }
          }
        }
      });

      console.log("Total meshes found in Sonic model:", meshCount);

      // Get player position for better placement
      const playerCamera = controls.getObject();
      const playerWorldPosition = new THREE.Vector3();
      playerCamera.getWorldPosition(playerWorldPosition);

      // Place Sonic in front of the player at ground level
      const distanceFromPlayer = 15; // Increased distance to make it more visible
      const sonicTargetPosition = playerWorldPosition.clone();

      // Place Sonic in front of the player
      const playerWorldDirection = new THREE.Vector3();
      playerCamera.getWorldDirection(playerWorldDirection);
      playerWorldDirection.y = 0; // Keep it horizontal
      playerWorldDirection.normalize();

      sonicTargetPosition.add(playerWorldDirection.multiplyScalar(distanceFromPlayer));
      sonicTargetPosition.y = player.position.y; // Same ground level as player

      sonicModel.position.copy(sonicTargetPosition);
      console.log("Sonic positioned at:", sonicTargetPosition);

      // Set appropriate scale - try different values if needed
      sonicModel.scale.set(5, 5, 5); // Increased scale to make it more visible
      console.log("Sonic scale set to:", sonicModel.scale);

      // Add the model to the scene
      scene.add(sonicModel);
      console.log("Sonic model added to scene.");

      // Add a bounding box helper to visualize the model bounds
      const sonicBoxHelper = new THREE.BoxHelper(sonicModel, 0xffff00);
      scene.add(sonicBoxHelper);
      console.log("Sonic BoxHelper added - if you see a yellow wireframe, the model is there!");

      // Add a bright test cube at the same position for reference
      const testCubeGeo = new THREE.BoxGeometry(3, 3, 3);
      const testCubeMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x004400 // Make it glow slightly
      });
      const testCube = new THREE.Mesh(testCubeGeo, testCubeMat);
      testCube.position.copy(sonicModel.position);
      testCube.position.y += 5; // Place it above Sonic
      scene.add(testCube);
      console.log("Green test cube added above Sonic at:", testCube.position);

      // Setup animations if available
      if (sonicAnimationClips && sonicAnimationClips.length > 0) {
        console.log("Setting up Sonic animations...");
        sonicMixer = new THREE.AnimationMixer(sonicModel);

        // Play the first animation
        const action = sonicMixer.clipAction(sonicAnimationClips[0]);
        action.play();
        console.log("Playing animation:", sonicAnimationClips[0].name);
      } else {
        console.log("No animations found for Sonic model");
      }

      // Force a render update
      renderer.render(scene, camera);
    },
    (xhr) => {
      const progress = (xhr.loaded / xhr.total) * 100;
      console.log(`Sonic model loading: ${progress.toFixed(2)}% loaded`);
    },
    (error) => {
      console.error("Error loading Sonic GLTF model:", error);
      console.error("Make sure the path 'sonic_spinning/scene.gltf' is correct");
      console.error("Check that all files (scene.gltf, scene.bin, textures) are in the right place");

      // Create a fallback object so you know the function ran
      const fallbackGeometry = new THREE.SphereGeometry(2, 16, 16);
      const fallbackMaterial = new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        emissive: 0x000044
      });
      const fallbackSonic = new THREE.Mesh(fallbackGeometry, fallbackMaterial);

      const playerCamera = controls.getObject();
      const playerPos = new THREE.Vector3();
      playerCamera.getWorldPosition(playerPos);

      fallbackSonic.position.set(
        playerPos.x,
        player.position.y + 3,
        playerPos.z - 10
      );

      scene.add(fallbackSonic);
      console.log("Added blue fallback sphere since Sonic model failed to load");
    }
  );
}

// Helper function to check if Sonic is visible
function checkSonicVisibility() {
  if (sonicModel) {
    console.log("=== SONIC MODEL DEBUG INFO ===");
    console.log("Sonic position:", sonicModel.position);
    console.log("Sonic scale:", sonicModel.scale);
    console.log("Sonic visible:", sonicModel.visible);
    console.log("Sonic in scene:", scene.children.includes(sonicModel));

    // Check distance from player
    const playerCamera = controls.getObject();
    const distance = sonicModel.position.distanceTo(playerCamera.position);
    console.log("Distance from player:", distance);

    // Check if it's within camera view
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);

    const sonicBox = new THREE.Box3().setFromObject(sonicModel);
    const isInView = frustum.intersectsBox(sonicBox);
    console.log("Is Sonic in camera view:", isInView);
    console.log("================================");
  } else {
    console.log("Sonic model is null or undefined");
  }
}


function setupLighting() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
  dirLight.position.set(40, 60, 35);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
}

function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
      keys.W = true;
      break;
    case "KeyA":
      keys.A = true;
      break;
    case "KeyS":
      keys.S = true;
      break;
    case "KeyD":
      keys.D = true;
      break;
    case "ShiftLeft":
      keys.SHIFT_LEFT = true;
      break;
    case "Space":
      keys.SPACE = true;
      break;
    case "KeyE":
      keys.E_INTERACT = true;
      if (controls.isLocked) handleInteraction();
      break;
    case "KeyQ":
      if (isGhostMode) {
        keys.Q_GHOST_DOWN = true;
      }
      break;
    case "KeyG":
      if (!keys.G) {
        isGhostMode = !isGhostMode;
        console.log("Ghost Mode:", isGhostMode ? "ON" : "OFF");
        if (isGhostMode) {
          player.velocity.y = 0;
        }
      }
      keys.G = true;
      break;
    case "KeyT": // Added case for 'KeyT'
      keys.T = true; // Optional: track key state if needed for onKeyUp or continuous press
      checkSonicVisibility();
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW":
      keys.W = false;
      break;
    case "KeyA":
      keys.A = false;
      break;
    case "KeyS":
      keys.S = false;
      break;
    case "KeyD":
      keys.D = false;
      break;
    case "ShiftLeft":
      keys.SHIFT_LEFT = false;
      break;
    case "Space":
      keys.SPACE = false;
      break;
    case "KeyE":
      keys.E_INTERACT = false;
      break;
    case "KeyQ":
      keys.Q_GHOST_DOWN = false;
      break;
    case "KeyG":
      keys.G = false;
      break;
    case "KeyT": // Added case for 'KeyT'
      keys.T = false; // Optional: track key state
      break;
  }
}

function startPaperAnimation(showTexture) {
  if (!paperAnimationActive) {
    paperAnimationActive = true;
    paperAnimationTime = 0;
    paperTargetOpacity = showTexture ? 1.0 : 0.0;
    paperCurrentOpacity = showTexture ? 0.0 : 1.0;

    if (showTexture && paperMesh && paperPrintMaterial) {
      paperMesh.material = paperPrintMaterial;
      if (paperMesh.material) paperMesh.material.opacity = paperCurrentOpacity;
    }
  }
}

function updatePaperAnimation(deltaTime) {
  if (paperAnimationActive) {
    paperAnimationTime += deltaTime;
    const progress = Math.min(
      paperAnimationTime / PAPER_ANIMATION_DURATION,
      1.0
    );
    const easeProgress =
      progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

    paperCurrentOpacity =
      paperCurrentOpacity +
      (paperTargetOpacity - paperCurrentOpacity) * easeProgress;

    if (
      paperMesh &&
      paperPrintMaterial &&
      paperMesh.material === paperPrintMaterial
    ) {
      if (paperMesh.material) paperMesh.material.opacity = paperCurrentOpacity;
    }

    if (progress >= 1.0) {
      paperAnimationActive = false;
      if (paperTargetOpacity === 0 && paperMesh && originalPaperMaterial) {
        paperMesh.material = originalPaperMaterial;
      }
    }
  }
}

function handleInteraction() {
  interactionRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const interactableSceneObjects = [];
  interactiveObjectNames.forEach((name) => {
    const obj = model.getObjectByName(name);
    if (obj) interactableSceneObjects.push(obj);
  });
  const actualInteractables = interactableSceneObjects.filter(
    (obj) => obj.children.length > 0 || obj.isMesh
  );
  const intersects = interactionRaycaster.intersectObjects(
    actualInteractables,
    true
  );

  if (intersects.length > 0 && intersects[0].distance < INTERACTION_DISTANCE) {
    const intersectedRawObject = intersects[0].object;
    let interactiveObjectName = intersectedRawObject.name;
    let current = intersectedRawObject;

    while (current && !interactiveObjectNames.includes(current.name)) {
      current = current.parent;
      if (current && current.isScene) {
        current = null;
        break;
      }
    }

    if (current) {
      interactiveObjectName = current.name;
    } else {
      if (interactiveObjectNames.includes(intersectedRawObject.name)) {
        interactiveObjectName = intersectedRawObject.name;
      } else {
        return;
      }
    }

    if (
      interactiveObjectName === "Object_13108" &&
      tvScreenMesh &&
      originalTVMaterial &&
      staticTVMaterial
    ) {
      isTVOn = !isTVOn;
      tvScreenMesh.material = isTVOn ? staticTVMaterial : originalTVMaterial;
    } else if (
      interactiveObjectName === "Object_23" ||
      interactiveObjectName === "Object_23025"
    ) {
      if (
        paperMesh &&
        originalPaperMaterial &&
        paperPrintMaterial &&
        !paperAnimationActive
      ) {
        isPaperTextureVisible = !isPaperTextureVisible;
        startPaperAnimation(isPaperTextureVisible);
      }
    } else if (interactiveObjectName === "Object_18" && steamObject) {
      isSteamActive = !isSteamActive;
      if (isSteamActive) {
        steamAnimationTime = 0;
        if (originalSteamPosition)
          steamObject.position.copy(originalSteamPosition);
        if (steamObject.material)
          steamObject.material.opacity = originalSteamOpacity;
        steamObject.visible = true;
      } else {
        steamObject.visible = false;
      }
    }
  }
}

function updatePlayerAndCamera(deltaTime) {
  if (controls.isLocked) {
    const camRef = controls.getObject();
    let baseSpeed = 8.0;
    let currentSpeed = (keys.SHIFT_LEFT ? 1.5 : 1) * baseSpeed;

    if (isGhostMode) {
      currentSpeed *= GHOST_MODE_SPEED_MULTIPLIER;
    }

    const actualSpeed = currentSpeed * deltaTime;

    camRef.getWorldDirection(_forward);
    if (!isGhostMode) {
      _forward.y = 0;
    }
    _forward.normalize();
    _right.crossVectors(camRef.up, _forward).normalize(); // Should be camRef.up not _upVector for FPS controls

    _movementDirection.set(0, 0, 0);
    if (keys.W) _movementDirection.add(_forward);
    if (keys.S) _movementDirection.sub(_forward);
    if (keys.A) _movementDirection.add(_right); // Changed from add to sub for conventional strafe left
    if (keys.D) _movementDirection.sub(_right); // Changed from sub to add for conventional strafe right

    // Corrected strafing logic: A should be left, D should be right
    // _right is to the right of the camera's forward.
    // To move left (A), you subtract _right.
    // To move right (D), you add _right.
    // The original code had this reversed.
    // However, the user code has A: add(_right) and D: sub(_right).
    // This means _right is actually pointing left. Let's assume their _right calculation is intended.
    // If camRef.up is (0,1,0) and _forward is (camX, 0, camZ), then
    // _right = (0,1,0).cross(camX,0,camZ) = (camZ, 0, -camX)
    // If forward is (0,0,-1) (looking down Z), right is (-1,0,0) (pointing left along -X)
    // So, A + _right moves left. D - _right moves right. This seems correct based on their vector math.


    if (_movementDirection.lengthSq() > 0) {
      _movementDirection.normalize();
    }

    const dX = _movementDirection.x * actualSpeed;
    const dYfromWASD = _movementDirection.y * actualSpeed; // This will be non-zero if ghost mode and looking up/down
    const dZ = _movementDirection.z * actualSpeed;


    if (isGhostMode) {
      player.velocity.y = 0;
      player.position.x += dX;
      player.position.y += dYfromWASD; // Apply vertical movement from looking up/down
      player.position.z += dZ;

      if (keys.SPACE) player.position.y += actualSpeed; // Fly up
      if (keys.Q_GHOST_DOWN) player.position.y -= actualSpeed; // Fly down

      player.isGrounded = false;
      // Langsung update posisi kamera di mode ghost
      camRef.position.copy(player.position);
    } else {
      // Mode Normal
      if (!player.isGrounded) {
        player.velocity.y -= GRAVITY * deltaTime;
      }

      if (keys.SPACE && player.isGrounded && player.canJump) {
        player.velocity.y = JUMP_IMPULSE;
        player.isGrounded = false;
        player.canJump = false;
      }
      if (!keys.SPACE) {
        player.canJump = true;
      }

      const groundRayOrigin = new THREE.Vector3(
        player.position.x,
        player.position.y + PLAYER_FEET_RADIUS * 0.5, // Raycast from slightly above feet center
        player.position.z
      );
      raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
      raycaster.far = Math.max(
        PLAYER_FEET_RADIUS * 1.1, // Minimum check distance
        Math.abs(player.velocity.y * deltaTime) + PLAYER_FEET_RADIUS // Dynamic distance based on fall speed
      );
      const groundHits = raycaster.intersectObjects(collidableMeshes, true);

      player.isGrounded = false; // Assume not grounded until check says otherwise

      if (
        player.velocity.y <= 0 && // Only ground if moving downwards or still
        groundHits.length > 0 &&
        groundHits[0].distance <= PLAYER_FEET_RADIUS * 1.01 // Check if the hit is close enough
      ) {
        player.position.y = groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2; // Set to base of collider
        player.velocity.y = 0;
        player.isGrounded = true;
      }

      player.position.y += player.velocity.y * deltaTime; // Apply gravity / jump

      // Head collision (ceiling check)
      if (player.velocity.y > 0) { // Only check if moving upwards
        const headOrigin = player.position
          .clone()
          .add(new THREE.Vector3(0, PLAYER_COLLISION_HEIGHT / 2 - 0.1, 0)); // From top of collider
        raycaster.set(headOrigin, new THREE.Vector3(0, 1, 0));
        raycaster.far = player.velocity.y * deltaTime + 0.2; // Check just above
        const headHits = raycaster.intersectObjects(collidableMeshes, true);
        if (headHits.length > 0) {
          player.position.y = headHits[0].point.y - PLAYER_COLLISION_HEIGHT / 2; // Adjust position to below ceiling
          player.velocity.y = 0; // Stop upward movement
        }
      }

      const tempPos = player.position.clone(); // Use player.position that has Y updated
      tempPos.x += dX;
      tempPos.z += dZ;

      // Bounding box now centered at player.position
      player.boundingBox.setFromCenterAndSize(
        new THREE.Vector3(tempPos.x, player.position.y, tempPos.z),
        new THREE.Vector3(
          playerRadiusBuffer * 2,
          PLAYER_COLLISION_HEIGHT,
          playerRadiusBuffer * 2
        )
      );

      let canMoveHorizontally = true;
      let steppedUp = false;

      if (dX !== 0 || dZ !== 0) { // Only check horizontal collisions if moving
        for (const mesh of collidableMeshes) {
          const meshBoundingBox = collisionBoundingBoxes.get(mesh.name);
          if (
            meshBoundingBox &&
            !meshBoundingBox.isEmpty() &&
            player.boundingBox.intersectsBox(meshBoundingBox)
          ) {
            let didStep = false;
            // Check head clearance for step, relative to player.position (center of collider)
            const headClearOrigin = player.position.clone();
            headClearOrigin.x +=
              _movementDirection.x * playerRadiusBuffer * 0.5; // Check slightly in movement direction
            headClearOrigin.z +=
              _movementDirection.z * playerRadiusBuffer * 0.5;
            headClearOrigin.y += MAX_STEP_HEIGHT + 0.1; // From center of collider + step height + buffer

            raycaster.set(headClearOrigin, _movementDirection); // Raycast in movement direction
            raycaster.far = playerRadiusBuffer; // How far to check for obstacles at head height

            // This head clearance check seems problematic. It's raycasting in the movement direction
            // from a point above the player. This isn't standard for step-up.
            // A more typical head clearance check for step-up would be a vertical raycast
            // from the potential step height *above the new stepped position*.
            // For now, using the provided logic.

            if (raycaster.intersectObject(mesh, true).length === 0) { // If no obstacle at head height in direction of move
              // Raycast from potential step surface downwards
              const stepSurfaceOrigin = new THREE.Vector3(
                tempPos.x, // Target XZ
                player.position.y + MAX_STEP_HEIGHT + PLAYER_FEET_RADIUS, // Start raycast from above max step height
                tempPos.z
              );
              raycaster.set(stepSurfaceOrigin, new THREE.Vector3(0, -1, 0)); // Raycast down
              raycaster.far = MAX_STEP_HEIGHT + PLAYER_FEET_RADIUS * 1.5; // Max distance to find step surface
              const stepHits = raycaster.intersectObject(mesh, true);

              if (stepHits.length > 0) {
                const yDiff =
                  stepHits[0].point.y +
                  PLAYER_COLLISION_HEIGHT / 2 - // Target player base pos
                  player.position.y; // Current player base pos (already includes PLAYER_COLLISION_HEIGHT/2 offset logic)
                if (yDiff >= -0.01 && yDiff <= MAX_STEP_HEIGHT) { // If the step is within acceptable height
                  player.position.set(
                    tempPos.x,
                    stepHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2, // New Y pos
                    tempPos.z
                  );
                  player.isGrounded = true; // Stepping up means grounded
                  player.velocity.y = 0;
                  steppedUp = true;
                  didStep = true;
                  break; // Stepped up, no need to check other meshes for this movement
                }
              }
            }
            if (!didStep) {
              canMoveHorizontally = false;
              break; // Collision without step, stop checking
            }
          }
        }
      }

      if (!steppedUp && canMoveHorizontally) {
        player.position.x = tempPos.x;
        player.position.z = tempPos.z;
      }
      // Update camera position after all player logic for normal mode is done
      camRef.position.set(
        player.position.x,
        player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
        player.position.z
      );
    }
  } else {
    // Controls not locked
    player.velocity.x = 0;
    player.velocity.z = 0;
    if (!isGhostMode) {
      // Only apply gravity if not in ghost mode
      if (!player.isGrounded) {
        player.velocity.y -= GRAVITY * deltaTime;
        player.position.y += player.velocity.y * deltaTime;
        // Check ground when falling with controls unlocked
        const groundRayOrigin = new THREE.Vector3(
          player.position.x,
          player.position.y + PLAYER_FEET_RADIUS * 0.5,
          player.position.z
        );
        raycaster.set(groundRayOrigin, new THREE.Vector3(0, -1, 0));
        raycaster.far = Math.max(
          PLAYER_FEET_RADIUS * 1.1,
          Math.abs(player.velocity.y * deltaTime) + PLAYER_FEET_RADIUS
        );
        const groundHits = raycaster.intersectObjects(collidableMeshes, true);
        if (
          player.velocity.y <= 0 &&
          groundHits.length > 0 &&
          groundHits[0].distance <= PLAYER_FEET_RADIUS * 1.01
        ) {
          player.position.y =
            groundHits[0].point.y + PLAYER_COLLISION_HEIGHT / 2;
          player.velocity.y = 0;
          player.isGrounded = true;
        }
        // Update camera position as well
        controls
          .getObject()
          .position.set(
            player.position.x,
            player.position.y + PLAYER_EYE_HEIGHT - PLAYER_COLLISION_HEIGHT / 2,
            player.position.z
          );
      }
    }
  }

  if (
    isTVOn &&
    staticTexture &&
    tvScreenMesh &&
    staticTVMaterial === tvScreenMesh.material
  ) {
    staticTexture.offset.x += Math.random() * 0.1 - 0.05;
    staticTexture.offset.y += Math.random() * 0.1 - 0.05;
    staticTexture.offset.x = ((staticTexture.offset.x % 1) + 1) % 1;
    staticTexture.offset.y = ((staticTexture.offset.y % 1) + 1) % 1;
  }

  if (
    isSteamActive &&
    steamObject &&
    originalSteamPosition &&
    steamObject.material
  ) {
    steamAnimationTime += deltaTime;
    let loopProgress =
      (steamAnimationTime % STEAM_LOOP_DURATION) / STEAM_LOOP_DURATION;
    steamObject.position.set(
      originalSteamPosition.x,
      originalSteamPosition.y + loopProgress * STEAM_MAX_HEIGHT_OFFSET,
      originalSteamPosition.z
    );
    if (steamObject.material)
      steamObject.material.opacity = originalSteamOpacity * (1 - loopProgress);
  }
  updatePaperAnimation(deltaTime);
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(0.05, clock.getDelta()); // Capped delta time

  updatePlayerAndCamera(deltaTime);

  if (sonicMixer) {
    sonicMixer.update(deltaTime);
  }

  renderer.render(scene, camera);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}