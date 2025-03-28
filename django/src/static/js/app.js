// Initialize the scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
const sceneContainer = document.getElementById('scene-container');
sceneContainer.appendChild(renderer.domElement);
// document.body.appendChild(renderer.domElement);

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(0, 2, 3);
scene.add(directionalLight);


// Environment (simplified version of city preset)
scene.background = new THREE.Color(0x171717);
// scene.environment = new THREE.CubeTextureLoader()
//     .setPath('https://threejs.org/examples/textures/cube/pisa/')
//     .load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

// Variables for our objects
let torus = null;
let textMesh = null;

// Create a glass-like material
const material = new THREE.MeshPhysicalMaterial({
    thickness: 1.5,            // Augmenter pour une réfraction plus prononcée
    roughness: 0.05,          // Réduire pour plus de clarté
    transmission: 1,          // Matériau transparent
    ior: 1.5,                 // Indice de réfraction (verre-like)
    chromaticAberration: 2.0, // Augmenter l'aberration chromatique
    backside: false,
    color: 0xffffff,
    transparent: true,        // Ajouter pour gérer la transparence
    opacity: 0.9              // Légère opacité pour réalisme
});

// Load the torus model
const loader = new THREE.GLTFLoader();
loader.load(
    '/media/torrus.glb',
    function (gltf) {
        torus = gltf.scene.children[0]; // Assuming the torus is the first child
        torus.material = material;
        torus.scale.set(4, 4, 4);
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
const fontPath = '/static/fonts/Staatliches_Regular.json'
fontLoader.load(
    fontPath,
    function (font) {
        const textGeometry = new THREE.TextGeometry('TRANSCENDENCE', {
            font: font,
            size: 1.5,
            height: 0.1,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5
        });
        textGeometry.center();

        // Matériau plus élaboré pour un meilleur rendu
        const textMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: 0x111111,
            shininess: 30,
            flatShading: true
        });

        textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = -1;

        // Ajout d'une ombre pour meilleure lisibilité
        // textMesh.castShadow = true;

        scene.add(textMesh);

        console.log('Texte créé avec PPNeueMontreal Bold');
    },
    undefined, // Callback de progression
    function (error) {
        console.error('Erreur de chargement de la police:', error);
        // Solution de repli avec police par défaut
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            function (fallbackFont) {
                // Créer le texte avec la police de repli
            }
        );
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
		// torus.rotation.y += 0.01;
    }

    renderer.render(scene, camera);
}

animate();
