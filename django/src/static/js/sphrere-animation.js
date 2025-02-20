document.addEventListener('DOMContentLoaded', function() {
    // Vérifiez si le conteneur existe sur cette page
    const container = document.getElementById('sphere-container');
    if (!container) return;

    // Chargez Three.js de manière asynchrone
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = initSphere;
    document.head.appendChild(script);

    function initSphere() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(0x000000, 0); // Fond transparent
        container.appendChild(renderer.domElement);

        // Création de la sphère wireframe
        const geometry = new THREE.SphereGeometry(5, 24, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // Position de la caméra
        camera.position.z = 15;

        // Animation
        function animate() {
            requestAnimationFrame(animate);

            // Rotation de la sphère
            sphere.rotation.x += 0.005;
            sphere.rotation.y += 0.01;

            renderer.render(scene, camera);
        }

        // Gestion du redimensionnement
        window.addEventListener('resize', () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        });

        // Démarrer l'animation
        animate();
    }
});
