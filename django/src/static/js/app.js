// Initialize the scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(0, 2, 3);
scene.add(directionalLight);

// Environment (simplified version of city preset)
scene.background = new THREE.Color(0x171717);
scene.environment = new THREE.CubeTextureLoader()
    .setPath('https://threejs.org/examples/textures/cube/pisa/')
    .load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

// Variables for our objects
let torus = null;
let textMesh = null;

// Create a glass-like material
const material = new THREE.MeshPhysicalMaterial({
    thickness: 0.2,
    roughness: 0,
    transmission: 1,
    ior: 0.5,
    chromaticAberration: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0,
    envMapIntensity: 1,
    color: 0xffffff
});

// Load the torus model
const loader = new THREE.GLTFLoader();
loader.load(
    'path/to/your/torrus.glb',
    function (gltf) {
        torus = gltf.scene.children[0]; // Assuming the torus is the first child
        torus.material = material;
        torus.scale.set(1, 1, 1);
        scene.add(torus);
    },
    undefined,
    function (error) {
        console.error('Error loading GLTF model:', error);
        // Fallback: create a torus geometry if model fails to load
        const geometry = new THREE.TorusGeometry(1.5, 0.8, 20, 200);
        torus = new THREE.Mesh(geometry, material);
        scene.add(torus);
    }
);

// Load font and create text
const fontLoader = new THREE.FontLoader();
fontLoader.load(
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    function (font) {
        const textGeometry = new THREE.TextGeometry('TRANSCENDENCE', {
            font: font,
            size: 1,
            height: 0.1
        });
        textGeometry.center();

        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = -1;
        scene.add(textMesh);
    }
);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (torus) {
        torus.rotation.x += 0.02;
		// torus.rotation.y += 0.02;
    }

    renderer.render(scene, camera);
}

animate();
