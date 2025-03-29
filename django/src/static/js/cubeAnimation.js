import * as THREE from 'three'

export class CubeAnimation {
	constructor(container) {
		this.container = container;
		this.initCube();
	}

	initCube() {
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		this.renderer.setClearColor(0x000000, 0);
		this.container.appendChild(this.renderer.domElement);

		// Stockez une référence au canvas
		this.canvas = this.renderer.domElement;

		const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
		const material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			wireframe: true,
			wireframeLinewidth: 2,
			transparent: true,
			opacity: 0.8
		});

		this.cube = new THREE.Mesh(geometry, material);
		this.scene.add(this.cube);
		this.camera.position.z = 3;

		this.animate();

		// Gestion du redimensionnement
		this.resizeHandler = () => {
			const width = this.container.clientWidth;
			const height = this.container.clientHeight;

			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height);
		};

		window.addEventListener('resize', this.resizeHandler);
	}

	animate() {
		if (!this.cube) return;

		this.animationId = requestAnimationFrame(() => this.animate());
		this.cube.rotation.x += 0.01;
		this.cube.rotation.y += 0.01;
		this.renderer.render(this.scene, this.camera);
	}

	cleanup() {
		// Arrêter l'animation
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		// Supprimer le gestionnaire de redimensionnement
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
		}

		// Nettoyer le canvas si possible
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}

		// Nettoyer les ressources Three.js
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer = null;
		}

		if (this.cube) {
			this.cube.geometry.dispose();
			this.cube.material.dispose();
			this.cube = null;
		}

		if (this.scene) {
			this.scene = null;
		}

		this.camera = null;
		this.container = null;
	}
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
	const container = document.getElementById('cube-container');
	window.cubeAnimation = new CubeAnimation(container);
});

// Export pour utilisation externe
window.CubeAnimation = CubeAnimation;
