import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

class Snake3D {
    constructor() {
        this.initSnake();
     }

    initSnake() {
        // Configuration du jeu (reste inchangée)
        this.gridSize = 20;
        this.tileCount = 20;
        this.gameStarted = false;
        this.paused = false;
        this.gameOver = false;
        this.score = 0;

        // État du serpent (reste inchangé)
        this.snake = [{ x: 9, y: 10 }];
        this.direction = { x: 1, y: 0 };
        this.food = {
            x: Math.floor(Math.random() * this.tileCount),
            y: Math.floor(Math.random() * this.tileCount)
        };

		this.obstacles = [];

		const obstacleCount = 20;
		this.generateObstacles(obstacleCount);

        // Initialiser Three.js
        this.setupThreeJS();
        this.createGrid();
        this.createSnake();
        this.createFood();
		this.createObstacles();
        this.setupLights();
        this.setupEventListeners();

        // Créer le score 3D
        this.createScore3D();

        // Démarrer l'animation
        this.animate();
    }

    generateObstacles(count) {
		this.obstacles = [];

		for (let i = 0; i < count; i++) {
			let obstacleX, obstacleY;
			let validPosition = false;

			while (!validPosition) {
				obstacleX = Math.floor(Math.random() * this.tileCount);
				obstacleY = Math.floor(Math.random() * this.tileCount);
				validPosition = true;

				// Vérifier si cette position est occupée par le serpent
				for (const segment of this.snake) {
					if (segment.x === obstacleX && segment.y === obstacleY) {
						validPosition = false;
						break;
					}
				}

				// Vérifier si cette position est occupée par la nourriture (seulement si this.food existe)
				if (this.food && this.food.x === obstacleX && this.food.y === obstacleY) {
					validPosition = false;
				}

				// Vérifier si cette position est trop proche de la tête du serpent au départ
				const headDistance = Math.sqrt(
					Math.pow(this.snake[0].x - obstacleX, 2) +
					Math.pow(this.snake[0].y - obstacleY, 2)
				);
				if (headDistance < 5) {
					validPosition = false;
				}

				// Vérifier si cette position est déjà occupée par un autre obstacle
				for (const obstacle of this.obstacles) {
					if (obstacle.x === obstacleX && obstacle.y === obstacleY) {
						validPosition = false;
						break;
					}
				}
			}

			this.obstacles.push({
				x: obstacleX,
				y: obstacleY
			});
		}
	}

    createObstacles() {
        // Créer un groupe pour contenir tous les obstacles
        if (!this.obstaclesGroup) {
            this.obstaclesGroup = new THREE.Group();
            this.scene.add(this.obstaclesGroup);
        } else {
            // Nettoyer les obstacles existants
            while (this.obstaclesGroup.children.length > 0) {
                const child = this.obstaclesGroup.children[0];
                this.obstaclesGroup.remove(child);
            }
        }

        // Créer un obstacle pour chaque position
        for (const obstacle of this.obstacles) {
            // Créer un cube gris pour chaque obstacle
            const obstacleGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const obstacleMaterial = new THREE.MeshStandardMaterial({
                color: 0x808080, // Gris
                roughness: 0.7,
                metalness: 0.2
            });

            const obstacleCube = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

            // Positionner l'obstacle sur la grille
            obstacleCube.position.set(
                (obstacle.x - this.tileCount / 2) + 0.5,
                0.4, // Même hauteur que le serpent
                (obstacle.y - this.tileCount / 2) + 0.5
            );

            // Ajouter des ombres
            obstacleCube.castShadow = true;
            obstacleCube.receiveShadow = true;

            // Ajouter l'obstacle au groupe
            this.obstaclesGroup.add(obstacleCube);
        }
    }


	// Modifiez la méthode createScore3D comme suit :
	createScore3D() {
		// Création d'un groupe pour le texte du score
		this.scoreGroup = new THREE.Group();
		this.scene.add(this.scoreGroup);

		// Créer un texte temporaire pendant le chargement de la police
		const tempGeometry = new THREE.BoxGeometry(4, 1, 0.5);
		const tempMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
		const tempMesh = new THREE.Mesh(tempGeometry, tempMaterial);
		tempMesh.position.set(
			this.tileCount / 2 + 2,
			5,
			0
		);
		this.scoreGroup.add(tempMesh);

		// Ajouter des logs pour le débogage
		console.log("Chargement de la police...");

		// Vérifier si FontLoader est disponible
		if (typeof FontLoader === 'undefined') {
			console.error("FontLoader n'est pas disponible!");
			// Chargement manuel de FontLoader
			const script = document.createElement('script');
			script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/examples/js/loaders/FontLoader.js";
			script.onload = () => {
				const textGeometry = document.createElement('script');
				textGeometry.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/examples/js/geometries/TextGeometry.js";
				textGeometry.onload = () => this.loadFont();
				document.head.appendChild(textGeometry);
			};
			document.head.appendChild(script);
		} else {
			this.loadFont();
		}
	}

	// Créer une méthode séparée pour charger la police
	loadFont() {
		const loader = new FontLoader();
		const fontUrl = 'https://threejs.org//examples/fonts/helvetiker_bold.typeface.json';

		loader.load(fontUrl,
			(font) => {
				this.scoreFont = font;
				this.updateScore3D();
			},
		);
	}

	// Améliorer la méthode updateScore3D pour un meilleur débogage
	updateScore3D() {
		if (!this.scoreFont) {
			return;
		}

		// Supprimer l'ancien texte de score
		while (this.scoreGroup.children.length > 0) {
			const oldMesh = this.scoreGroup.children[0];
			if (oldMesh.geometry) oldMesh.geometry.dispose();
			if (oldMesh.material) oldMesh.material.dispose();
			this.scoreGroup.remove(oldMesh);
		}

		try {
			// Vérifier si TextGeometry est disponible
			if (typeof TextGeometry === 'undefined') {
				console.error("TextGeometry n'est pas disponible!");
				return;
			}

			// Créer le nouveau texte
			const textGeometry = new TextGeometry(`${this.score}`, {
				font: this.scoreFont,
				size: 3,
				height: 0.8,
				curveSegments: 6,  // Réduire pour de meilleures performances
				bevelEnabled: true,
				bevelThickness: 0.05,
				bevelSize: 0.03,
				bevelOffset: 0,
				bevelSegments: 3   // Réduire pour de meilleures performances
			});

			// Centrer la géométrie
			textGeometry.computeBoundingBox();

			// Matériau plus simple pour la performance
			const textMaterial = new THREE.MeshStandardMaterial({
				color: 0x090909,
				roughness: 0.3
			});

			const textMesh = new THREE.Mesh(textGeometry, textMaterial);

			// Position plus visible
			textMesh.position.set(
				0,
				0,
				-this.tileCount + 5
			);

			// Rotation pour faire face à la caméra
			textMesh.rotation.y = 0;

			textMesh.castShadow = true;
			this.scoreGroup.add(textMesh);

		} catch (error) {
			console.error("Erreur lors de la création du texte 3D:", error);
		}
	}

	createGradientTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;

		const context = canvas.getContext('2d');

		// Créer un dégradé linéaire
		const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, '#939090'); // Couleur du haut (bleu ciel)
		gradient.addColorStop(0.3, '#F7F7F7'); // Couleur du bas (blanc)
		gradient.addColorStop(1, '#FFFFFF'); // Couleur du bas (blanc)

		// Remplir le canvas avec le dégradé
		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);

		// Convertir le canvas en texture Three.js
		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}


	setupThreeJS() {
		// Créer la scène, la caméra et le rendu
		this.scene = new THREE.Scene();
		this.scene.background = this.createGradientTexture(); // Appliquer le dégradé
		// this.scene.background = new THREE.Color(0xffffff)
		this.camera = new THREE.PerspectiveCamera(
			35, // Champ de vision (FOV)
			window.innerWidth / window.innerHeight, // Ratio d'aspect
			0.1, // Plan proche
			1000 // Plan éloigné
		);

		// Positionner la caméra pour une vue presque isométrique
		this.camera.position.set(-15, 25, 35);
		// this.camera.position.set(0, 25, 0);
		this.camera.lookAt(0, 0, 0);

		// Créer le rendu
		this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            precision: "highp",
            powerPreference: "high-performance"
        });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(this.renderer.domElement);

		// Groupe pour le serpent
		this.snakeGroup = new THREE.Group();
		this.scene.add(this.snakeGroup);

		const planeGeometry = new THREE.PlaneGeometry(this.tileCount + 2, this.tileCount + 2);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0xF7F7F7,
            roughness: 0.8,
            metalness: 0.2
        });
        this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.position.y = -0.1;
        this.plane.receiveShadow = true;
        this.scene.add(this.plane);
	}

    createGrid() {
        // Créer une grille pour le fond
        const gridHelper = new THREE.GridHelper(
            this.tileCount,
            this.tileCount,
            0x5A5A5A,
            0x5B5B5B
        );
        this.scene.add(gridHelper);
    }

	createEyes() {
		// Créer un seul cylindre qui traverse la tête
		const eyeGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.85, 32, 4); // Rayon de 0.1, longueur de 0.8
		const eyeMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.2,
            metalness: 0.1
		});
		const eyeball = new THREE.Mesh(eyeGeometry, eyeMaterial);
		eyeball.catShadow = true;

		// Créer les pupilles (sphères noires)
		const pupilGeometry = new THREE.SphereGeometry(0.1, 16, 16); // Rayon de 0.05
		const pupilMaterial = new THREE.MeshStandardMaterial({
			color: 0x000000,
			roughness: 0.1,
			metalness: 0.5
		});

		// Pupille gauche
		const pupilLeft = new THREE.Mesh(pupilGeometry, pupilMaterial);
		pupilLeft.position.set(0, 0.4, 0); // Positionner à gauche du cylindre
		eyeball.add(pupilLeft);

		// Pupille droite
		const pupilRight = new THREE.Mesh(pupilGeometry, pupilMaterial);
		pupilRight.position.set(0, -0.4, 0); // Positionner à droite du cylindre
		eyeball.add(pupilRight);

		// Orienter le cylindre horizontalement
		eyeball.rotation.x = Math.PI / 2;

		return eyeball;
	}

	createMouth() {
		const mouthGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.2, 2, 2, 2); // Largeur: 0.4, Hauteur: 0.1, Profondeur: 0.2
		const mouthMaterial = new THREE.MeshStandardMaterial({
			color: 0xff0000,
			roughness: 0.3,
		});
		const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
		mouth.castShadow = true;

		return mouth;
	}

	createSnakeSegment(position, isHead = false) {
		// Créer un segment du serpent avec des coins arrondis
		const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8, 3, 3, 3); // Largeur, hauteur, profondeur, segments, rayon des coins
		const material = new THREE.MeshStandardMaterial({
			color: isHead ? 0x006947: 0x01B27B,
			roughness: 0.3,
			// emissive: isHead ? 0x331100 : 0x220000,
			// emissiveIntensity: 0.2
		});

		const segment = new THREE.Mesh(geometry, material);
		segment.castShadow = true;
        segment.receiveShadow = true;

		// Ajuster la position pour aligner avec les cases de la grille
		segment.position.set(
			(position.x - this.tileCount / 2) + 0.5, // Ajouter 0.5 pour centrer dans la case
			0.4, // Position y (hauteur)
			(position.y - this.tileCount / 2) + 0.5  // Ajouter 0.5 pour centrer dans la case
		);

		if (isHead) {
			// Ajouter des yeux à la tête

			const eyes = this.createEyes();
			const mouth = this.createMouth();

			eyes.position.set(0, 0.1, 0);
			mouth.position.set(0, -0.2, 0.45);

			segment.add(eyes);
			segment.add(mouth);
		}

		return segment;
	}

	// Ajouter cette méthode pour créer un segment de connexion entre deux parties du serpent
	createConnector(positionA, positionB) {
		// Calculer le centre et la direction entre les deux positions
		const midX = (positionA.x + positionB.x) / 2;
		const midY = (positionA.y + positionB.y) / 2;

		// Calculer la différence entre les positions
		const diffX = positionB.x - positionA.x;
		const diffY = positionB.y - positionA.y;

		const connectorGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6)

		const connectorMaterial = new THREE.MeshStandardMaterial({
			color: 0x02C589, // Couleur entre celle de la tête et du corps
			roughness: 0.3,
			emissive: 0x220000,
			emissiveIntensity: 0.2
		});

		const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
		connector.castShadow = true;
		connector.receiveShadow = true;

		// Positionner le connecteur au milieu
		connector.position.set(
			(midX - this.tileCount / 2) + 0.5,
			0.4, // Même hauteur que les segments
			(midY - this.tileCount / 2) + 0.5
		);

		// Orienter le connecteur correctement
		if (Math.abs(diffX) > 0) {
			// Connexion horizontale
			connector.rotation.z = Math.PI / 2;
		} else if (Math.abs(diffY) > 0) {
			// Connexion verticale
			connector.rotation.x = Math.PI / 2;
		}

		return connector;
		}

		createSnake() {
			// Supprimer tous les segments existants
			while (this.snakeGroup.children.length > 0) {
				const child = this.snakeGroup.children[0];
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
				this.snakeGroup.remove(child);
			}

			// Créer les segments principaux du serpent
			for (let i = 0; i < this.snake.length; i++) {
				const isHead = i === 0;
				const mesh = this.createSnakeSegment(this.snake[i], isHead);
				this.snakeGroup.add(mesh);

				if (isHead) {
					this.updateEyes(mesh);
				}

				// Ajouter un connecteur entre ce segment et le suivant (sauf pour le dernier segment)
				if (i < this.snake.length - 1) {
					const connector = this.createConnector(this.snake[i], this.snake[i + 1]);
					this.snakeGroup.add(connector);
				}
			}
		}

    createFood() {
        // Créer la nourriture
        const foodGeometry = new THREE.SphereGeometry(0.3, 24, 24);
        const foodMaterial = new THREE.MeshStandardMaterial({
			color: 0xff0000,
			roughness: 0.1,
            emissive: 0x330000,
            emissiveIntensity: 0.5
		});
        this.foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
		this.foodMesh.castShadow = true;
        this.updateFoodPosition();
        this.scene.add(this.foodMesh);
    }

    updateFoodPosition() {
        // Positionner la nourriture
        this.foodMesh.position.set(
            (this.food.x - this.tileCount / 2) + 0.5,
            0.3,
            (this.food.y - this.tileCount / 2) + 0.5
        );
    }


	setupLights() {
		// Lumière ambiante blanche pour l'éclairage général
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
		this.scene.add(ambientLight);

		// Lumière directionnelle principale avec ombres (blanc pur)
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
		directionalLight.position.set(15, 25, 15);
		directionalLight.castShadow = true;

		// Améliorer la qualité des ombres
		directionalLight.shadow.mapSize.width = 2048;
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.camera.left = -15;
		directionalLight.shadow.camera.right = 15;
		directionalLight.shadow.camera.top = 15;
		directionalLight.shadow.camera.bottom = -15;
		directionalLight.shadow.bias = -0.0005;

		this.scene.add(directionalLight);

		// Remplacer la lumière bleue par une lumière blanche
		const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
		backLight.position.set(-10, 15, -10);
		this.scene.add(backLight);

		// Ajouter une lumière de remplissage blanche par le bas
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
		fillLight.position.set(0, -10, 5);
		this.scene.add(fillLight);

	}

	setupEventListeners() {
		this.keydownHandler = (event) => {
			if (event.key === 'Escape' && this.gameStarted) {
				this.paused = !this.paused;
			}
			if (!this.paused) {
				switch (event.key) {
					case 'ArrowUp':
					case 'z':
						if (this.direction.y === 0) this.direction = { x: 0, y: -1 };
						break;
					case 'ArrowDown':
					case 's':
						if (this.direction.y === 0) this.direction = { x: 0, y: 1 };
						break;
					case 'ArrowRight':
					case 'd':
						if (this.direction.x === 0) this.direction = { x: 1, y: 0 };
						break;
					case 'ArrowLeft':
					case 'q':
						if (this.direction.x === 0) this.direction = { x: -1, y: 0 };
						break;
				}
			}
			if (!this.gameStarted && event.key === ' ') {
				this.gameStarted = true;
				this.startGame();
			}
			if (this.gameOver && event.key === ' ') {
				this.resetGame();
			}
		};
		document.addEventListener('keydown', this.keydownHandler);

		this.resizeHandler = () => {
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', this.resizeHandler);
	}


	updateEyes(headSegment) {
		const eyes = headSegment.children;

		// Supprimer les anciens yeux et la bouche
		while (eyes.length > 0) {
			headSegment.remove(eyes[0]);
		}

		// Créer de nouveaux yeux et la bouche
		const eyeMesh = this.createEyes();
		const mouth = this.createMouth();

		if (this.direction.x === 1) {
			// Direction droite
			eyeMesh.rotation.y = 0;
			eyeMesh.rotation.z = 0;
			mouth.position.set(0.4, -0.2, 0);
			mouth.rotation.y = Math.PI / 2;
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.x === -1) {
			// Direction gauche
			eyeMesh.rotation.y = Math.PI;
			eyeMesh.rotation.z = 0;
			mouth.position.set(-0.4, -0.2, 0);
			mouth.rotation.y = -Math.PI / 2;
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.y === 1) {
			// Direction bas
			eyeMesh.rotation.z = Math.PI / 2;
			mouth.position.set(0, -0.2, 0.4);
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.y === -1) {
			// Direction haut
			eyeMesh.rotation.z = -Math.PI / 2;
			mouth.position.set(0, -0.2, -0.4);
			mouth.rotation.z = -Math.PI / 2;
		}

		headSegment.add(eyeMesh);
		headSegment.add(mouth);
	}

    startGame() {
        if (!this.gameLoop) {
            // Démarrer la boucle de jeu
            this.gameLoop = setInterval(() => this.update(), 200); // Mettre à jour le jeu toutes les 200 ms
        }
    }

	update() {
		if (this.paused) {
			return;
		}
		if (!this.gameStarted) {
			return;
		}
		// Vérifier que le jeu est dans un état valide
		if (!this.snake || this.snake.length === 0 || !this.renderer) {
			console.warn("Game state is invalid, stopping game loop.");
			clearInterval(this.gameLoop);
			this.gameLoop = null;
			return; // Ne pas appeler resetGame ici
		}

		if (this.checkCollision()) {
			this.gameOver = true;
			clearInterval(this.gameLoop);
			this.gameLoop = null;
			return;
		}
		this.moveSnake();
	}

	moveSnake() {
		// Vérifier que le serpent existe et a au moins une tête
		if (!this.snake || this.snake.length === 0) {
			console.warn("Snake array is empty or undefined, stopping movement.");
			return;
		}

		const head = {
			x: this.snake[0].x + this.direction.x,
			y: this.snake[0].y + this.direction.y
		};
		this.snake.unshift(head);

		if (head.x === this.food.x && head.y === this.food.y) {
			this.score++;
			this.food = {
				x: Math.floor(Math.random() * this.tileCount),
				y: Math.floor(Math.random() * this.tileCount)
			};

			let validFoodPosition = false;
			while (!validFoodPosition) {
				validFoodPosition = true;

				for (const obstacle of this.obstacles) {
					if (this.food.x === obstacle.x && this.food.y === obstacle.y) {
						validFoodPosition = false;
						this.food = {
							x: Math.floor(Math.random() * this.tileCount),
							y: Math.floor(Math.random() * this.tileCount)
						};
						break;
					}
				}

				for (const segment of this.snake) {
					if (this.food.x === segment.x && this.food.y === segment.y) {
						validFoodPosition = false;
						this.food = {
							x: Math.floor(Math.random() * this.tileCount),
							y: Math.floor(Math.random() * this.tileCount)
						};
						break;
					}
				}
			}

			this.updateFoodPosition();
			this.updateScore3D();
		} else {
			this.snake.pop();
		}
		this.createSnake();

		const headSegment = this.snakeGroup.children[0];
		this.updateEyes(headSegment);
	}

	checkCollision() {
		// Vérifier d'abord si le serpent existe et a au moins une section (la tête)
		if (!this.snake || this.snake.length === 0) {
			return false;  // Ou true, selon votre logique de jeu
		}

		const head = this.snake[0];

		// Vérifier les collisions avec les bords
		if (
			head.x < 0 ||
			head.x >= this.tileCount ||
			head.y < 0 ||
			head.y >= this.tileCount
		) {
			return true;
		}

		// Vérifier les collisions avec le corps du serpent
		for (let i = 1; i < this.snake.length; i++) {
			if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
				return true;
			}
		}

		// Vérifier les collisions avec les obstacles
		for (const obstacle of this.obstacles) {
			if (head.x === obstacle.x && head.y === obstacle.y) {
				return true;
			}
		}

		return false;
	}

    resetGame() {
		this.snake = [{ x: 9, y: 10 }];
		this.direction = { x: 1, y: 0 };
		this.score = 0;
		this.gameOver = false;
		this.gameStarted = true;

		// Initialiser this.food AVANT generateObstacles
		this.food = {
			x: Math.floor(Math.random() * this.tileCount),
			y: Math.floor(Math.random() * this.tileCount)
		};

		// Régénérer les obstacles après avoir défini this.food
		this.generateObstacles(Math.floor(this.tileCount * 0.15));
		this.createObstacles();

		// S'assurer que la nourriture n'apparaît pas sur un obstacle
		let validFoodPosition = false;
		while (!validFoodPosition) {
			validFoodPosition = true;
			for (const obstacle of this.obstacles) {
				if (this.food.x === obstacle.x && this.food.y === obstacle.y) {
					validFoodPosition = false;
					this.food = {
						x: Math.floor(Math.random() * this.tileCount),
						y: Math.floor(Math.random() * this.tileCount)
					};
					break;
				}
			}
		}

		this.updateFoodPosition();
		this.createSnake();
		this.updateScore3D();
		this.startGame();
	}

	animate() {
		// Vérifier si le renderer existe avant de poursuivre
		if (!this.renderer) return;

		this.animationFrameId = requestAnimationFrame(() => this.animate());
		this.renderer.render(this.scene, this.camera);
	}

	cleanup() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		if (this.gameLoop) {
			clearInterval(this.gameLoop);
			this.gameLoop = null;
		}
		if (this.keydownHandler) {
			document.removeEventListener('keydown', this.keydownHandler);
		}
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
		}

		if (this.scene) {
			while (this.scene.children.length > 0) {
				const child = this.scene.children[0];
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
				this.scene.remove(child);
			}
		}
		if (this.renderer) {
			if (this.renderer.domElement && this.renderer.domElement.parentNode) {
				this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
			}
			this.renderer.dispose();
			this.renderer = null;
		}

		this.gameStarted = false;
		this.paused = false;
		this.gameOver = false;
		this.score = 0;
		this.snake = [];
		this.food = null;
		this.obstacles = [];
	}
}

// Initialiser le jeu au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.snakeGame = new Snake3D();
});

window.Snake3D = Snake3D;
