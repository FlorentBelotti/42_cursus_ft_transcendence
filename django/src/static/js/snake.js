import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
console.log('THREE namespace:', THREE); // Should show the THREE object
console.log('FontLoader:', FontLoader);


class Snake3D {
    constructor() {
        this.initSnake();
     }

    initSnake() {
        // Configuration du jeu (reste inchangée)
		console.log('THREE namespace:', THREE); // Should show the THREE object
		console.log('FontLoader:', FontLoader);

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
        this.updateScore3D();

        // Afficher le classement
        this.displayLeaderboard();

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
        if (!this.obstaclesGroup) {
            this.obstaclesGroup = new THREE.Group();
            this.scene.add(this.obstaclesGroup);
        } else {
            while (this.obstaclesGroup.children.length > 0) {
                const child = this.obstaclesGroup.children[0];
                this.obstaclesGroup.remove(child);
            }
        }

        for (const obstacle of this.obstacles) {
            const obstacleGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const obstacleMaterial = new THREE.MeshStandardMaterial({
                color: 0x546E7A,
                roughness: 0.5,
                metalness: 0.2,
                emissive: 0x37474F,
                emissiveIntensity: 0.1
            });

            const obstacleCube = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
            obstacleCube.position.set(
                (obstacle.x - this.tileCount / 2) + 0.5,
                0.4,
                (obstacle.y - this.tileCount / 2) + 0.5
            );

            obstacleCube.castShadow = true;
            obstacleCube.receiveShadow = true;

            this.obstaclesGroup.add(obstacleCube);
        }
    }


	updateScore3D() {
		// Supprimer l'ancien score s'il existe
		if (this.scoreGroup) {
			this.scene.remove(this.scoreGroup);
		}

		// Créer un nouveau groupe pour le score
		this.scoreGroup = new THREE.Group();
		this.scene.add(this.scoreGroup);

		const loader = new FontLoader();
		loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
			// Créer le texte du score
			const scoreText = `${this.score}`;
			const scoreGeometry = new TextGeometry(scoreText, {
				font: font,
				size: 3,
				height: 0.5,
				curveSegments: 12,
				bevelEnabled: true,
				bevelThickness: 0.02,
				bevelSize: 0.02,
				bevelOffset: 0,
				bevelSegments: 5
			});

			const material = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				roughness: 0.3,
				// metalness: 0.8
			});

			const scoreMesh = new THREE.Mesh(scoreGeometry, material);
			// Positionner le score en dehors du plan de jeu, en haut à gauche
			scoreMesh.position.set(0, 2, -this.tileCount/2 );
			scoreMesh.rotation.y = 0; // Pas de rotation pour une meilleure lisibilité

			// Centrer le texte
			scoreGeometry.computeBoundingBox();
			const scoreBoundingBox = scoreGeometry.boundingBox;
			const scoreCenterOffset = -(scoreBoundingBox.max.x - scoreBoundingBox.min.x) / 2;
			scoreMesh.position.x += scoreCenterOffset;

			this.scoreGroup.add(scoreMesh);
		});
	}

	createGradientTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;

		const context = canvas.getContext('2d');

		// Créer un dégradé avec les couleurs spécifiées
		const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, '#0a0a0a'); // Vert clair (groundColor)
		gradient.addColorStop(0.5, '#0d0d0d'); // Teinte intermédiaire
		gradient.addColorStop(1, '#181818'); // Vert clair (groundColor)


		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);

		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}


	setupThreeJS() {
		// Créer la scène, la caméra et le rendu
		try {
			if (typeof THREE === 'undefined') {
				throw new Error('Three.js not loaded');
			}
			this.scene = new THREE.Scene();
			this.scene.background = this.createGradientTexture();
			this.camera = new THREE.PerspectiveCamera(
				35,
				window.innerWidth / window.innerHeight,
				0.1,
				1000
			);

			this.camera.position.set(0, 5, 10);
			this.camera.lookAt(0, 0, 0);

			this.finalCameraPosition = new THREE.Vector3(-15, 25, 35);

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

			this.snakeGroup = new THREE.Group();
			this.scene.add(this.snakeGroup);

			// Créer un plan transparent
			const planeGeometry = new THREE.PlaneGeometry(this.tileCount + 2, this.tileCount + 2);
			const planeMaterial = new THREE.MeshStandardMaterial({
				transparent: true,
				opacity: 0,
				side: THREE.DoubleSide
			});
			this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
			this.plane.rotation.x = -Math.PI / 2;
			this.plane.position.y = -0.1;
			this.plane.receiveShadow = true;
			this.scene.add(this.plane);

			this.arrowsGroup = new THREE.Group();
			this.scene.add(this.arrowsGroup);
			this.createDirectionalArrows();
		} catch (error) {
    	    console.error('Three.js initialization failed:', error);
    	    document.getElementById('message').textContent =
    	        'Error loading 3D engine. Please refresh the page.';
    	}
	}

    createGrid() {
        // Créer une grille avec des lignes plus claires
        const gridHelper = new THREE.GridHelper(
            this.tileCount,
            this.tileCount,
            0xffffff, // Lignes principales plus claires
            0xffffff  // Lignes secondaires plus claires
        );
        gridHelper.position.y = -0.1; // Positionner légèrement en dessous du plan
        this.scene.add(gridHelper);
    }

	createEyes(isDead = false) {
		// Créer un seul cylindre qui traverse la tête
		const eyeGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.85, 32, 4);
		const eyeMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.2,
			metalness: 0.1
		});
		const eyeball = new THREE.Mesh(eyeGeometry, eyeMaterial);
		eyeball.castShadow = true;

		if (isDead) {
			// Créer des croix pour les yeux morts
			const crossGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8); // Plus petit et plus fin
			const crossMaterial = new THREE.MeshStandardMaterial({
				color: 0x000000,
				roughness: 0.1,
				metalness: 0.5
			});

			// Croix gauche
			const leftCross = new THREE.Group();
			const leftVertical = new THREE.Mesh(crossGeometry, crossMaterial);
			const leftHorizontal = new THREE.Mesh(crossGeometry, crossMaterial);
			leftVertical.rotation.x = Math.PI / 2;
			leftHorizontal.rotation.z = Math.PI / 2;
			leftCross.add(leftVertical);
			leftCross.add(leftHorizontal);
			leftCross.position.set(0, 0.4, 0);
			leftCross.rotation.y = Math.PI / 4; // Rotation de 45 degrés
			eyeball.add(leftCross);

			// Croix droite
			const rightCross = new THREE.Group();
			const rightVertical = new THREE.Mesh(crossGeometry, crossMaterial);
			const rightHorizontal = new THREE.Mesh(crossGeometry, crossMaterial);
			rightVertical.rotation.x = Math.PI / 2;
			rightHorizontal.rotation.z = Math.PI / 2;
			rightCross.add(rightVertical);
			rightCross.add(rightHorizontal);
			rightCross.position.set(0, -0.4, 0);
			rightCross.rotation.y = Math.PI / 4; // Rotation de 45 degrés
			eyeball.add(rightCross);
		} else {
			// Créer les pupilles (sphères noires) pour les yeux vivants
			const pupilGeometry = new THREE.SphereGeometry(0.1, 16, 16);
			const pupilMaterial = new THREE.MeshStandardMaterial({
				color: 0x000000,
				roughness: 0.1,
				metalness: 0.5
			});

			// Pupille gauche
			const pupilLeft = new THREE.Mesh(pupilGeometry, pupilMaterial);
			pupilLeft.position.set(0, 0.4, 0);
			eyeball.add(pupilLeft);

			// Pupille droite
			const pupilRight = new THREE.Mesh(pupilGeometry, pupilMaterial);
			pupilRight.position.set(0, -0.4, 0);
			eyeball.add(pupilRight);
		}

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
		const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8, 3, 3, 3);
		const material = new THREE.MeshStandardMaterial({
			color: isHead ? 0x006947 : 0x01B27B, // Couleurs d'origine du serpent
			roughness: 0.2,
			metalness: 0.3,
			emissive: isHead ? 0x003D1F : 0x004D26, // Légère lueur verte plus sombre
			emissiveIntensity: 0.1
		});

		const segment = new THREE.Mesh(geometry, material);
		segment.castShadow = true;
		segment.receiveShadow = true;

		segment.position.set(
			(position.x - this.tileCount / 2) + 0.5,
			0.4,
			(position.y - this.tileCount / 2) + 0.5
		);

		if (isHead) {
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
        const foodGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const foodMaterial = new THREE.MeshStandardMaterial({
			color: 0xFF5252, // Rouge vif
			roughness: 0.5,
			metalness: 0.2,
			emissive: 0xFF1744, // Lueur rouge
			emissiveIntensity: 0.1
		});
        this.foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
		this.foodMesh.castShadow = true;
		this.foodMesh.receiveShadow = true;
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
		// Lumière ambiante plus douce
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
		this.scene.add(ambientLight);

		// Lumière directionnelle principale avec ombres
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

		// Lumière de remplissage avec une teinte légèrement bleue
		const backLight = new THREE.DirectionalLight(0xE3F2FD, 0.3);
		backLight.position.set(-10, 15, -10);
		this.scene.add(backLight);

		// Lumière de remplissage par le bas avec une teinte légèrement verte
		const fillLight = new THREE.DirectionalLight(0xE8F5E9, 0.2);
		fillLight.position.set(0, -10, 5);
		this.scene.add(fillLight);

	}

	setupEventListeners() {
		this.keydownHandler = (event) => {
			if (event.key === ' ' && this.gameStarted) {
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


	updateEyes(headSegment, isDead = false) {
		const eyes = headSegment.children;

		// Supprimer les anciens yeux et la bouche
		while (eyes.length > 0) {
			headSegment.remove(eyes[0]);
		}

		// Créer de nouveaux yeux et la bouche
		const eyeMesh = this.createEyes(isDead);
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
            // Afficher les flèches
            this.arrowsGroup.visible = true;

            // Animer la transition de la caméra
            this.animateCameraTransition();

            // Déplacer le classement vers la position jeu
            this.positionLeaderboard(true);

            // Démarrer la boucle de jeu après un court délai
            setTimeout(() => {
                this.gameLoop = setInterval(() => this.update(), 200);
            }, 2000);
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

			// Ajouter 3 nouveaux obstacles tous les 5 points
			if (this.score % 5 === 0) {
				for (let i = 0; i < 3; i++) {
					this.addNewObstacle();
				}
			}

			// Générer une nouvelle position pour la nourriture
			this.generateNewFoodPosition();
			this.updateFoodPosition();
			this.updateScore3D();
		} else {
			this.snake.pop();
		}
		this.createSnake();

		const headSegment = this.snakeGroup.children[0];
		this.updateEyes(headSegment);
	}

	addNewObstacle() {
		let newObstacle;
		let validPosition = false;

		while (!validPosition) {
			newObstacle = {
				x: Math.floor(Math.random() * this.tileCount),
				y: Math.floor(Math.random() * this.tileCount)
			};

			validPosition = true;

			// Vérifier si la position est déjà occupée par un obstacle
			for (const obstacle of this.obstacles) {
				if (obstacle.x === newObstacle.x && obstacle.y === newObstacle.y) {
					validPosition = false;
					break;
				}
			}

			// Vérifier si la position est occupée par le serpent
			for (const segment of this.snake) {
				if (segment.x === newObstacle.x && segment.y === newObstacle.y) {
					validPosition = false;
					break;
				}
			}

			// Vérifier si la position est occupée par la nourriture
			if (this.food && this.food.x === newObstacle.x && this.food.y === newObstacle.y) {
				validPosition = false;
			}
		}

		this.obstacles.push(newObstacle);
		this.createObstacles();
	}

	generateNewFoodPosition() {
		let validPosition = false;

		while (!validPosition) {
			this.food = {
				x: Math.floor(Math.random() * this.tileCount),
				y: Math.floor(Math.random() * this.tileCount)
			};

			validPosition = true;

			// Vérifier si la position est occupée par un obstacle
			for (const obstacle of this.obstacles) {
				if (obstacle.x === this.food.x && obstacle.y === this.food.y) {
					validPosition = false;
					break;
				}
			}

			// Vérifier si la position est occupée par le serpent
			for (const segment of this.snake) {
				if (segment.x === this.food.x && segment.y === this.food.y) {
					validPosition = false;
					break;
				}
			}
		}
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
			this.handleGameOver();
			return true;
		}

		// Vérifier les collisions avec le corps du serpent
		for (let i = 1; i < this.snake.length; i++) {
			if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
				this.handleGameOver();
				return true;
			}
		}

		// Vérifier les collisions avec les obstacles
		for (const obstacle of this.obstacles) {
			if (head.x === obstacle.x && head.y === obstacle.y) {
				this.handleGameOver();
				return true;
			}
		}

		return false;
	}

	moveLeaderboardToCamera() {
		if (!this.leaderboardGroup) return;

		// Position finale du classement (devant la caméra)
		const finalPosition = new THREE.Vector3(0, 0, -5);
		const finalRotation = new THREE.Euler(0, 0, 0);

		// Animation du déplacement
		const duration = 1000; // 1 seconde
		const startTime = Date.now();
		const startPosition = this.leaderboardGroup.position.clone();
		const startRotation = this.leaderboardGroup.rotation.clone();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Interpolation linéaire de la position et de la rotation
			this.leaderboardGroup.position.lerpVectors(startPosition, finalPosition, progress);
			this.leaderboardGroup.rotation.x = THREE.MathUtils.lerp(startRotation.x, finalRotation.x, progress);
			this.leaderboardGroup.rotation.y = THREE.MathUtils.lerp(startRotation.y, finalRotation.y, progress);
			this.leaderboardGroup.rotation.z = THREE.MathUtils.lerp(startRotation.z, finalRotation.z, progress);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	handleGameOver() {
		this.gameOver = true;
		clearInterval(this.gameLoop);
		this.gameLoop = null;

		// Mettre à jour les yeux pour afficher des croix
		const headSegment = this.snakeGroup.children[0];
		this.updateEyes(headSegment, true);

		// Position finale de la caméra (vue rapprochée du serpent)
		const finalCameraPosition = new THREE.Vector3(0, 5, 10);
		const finalCameraLookAt = new THREE.Vector3(0, 0, 0);

		// Animation de la caméra
		const duration = 1000; // 1 seconde
		const startTime = Date.now();
		const startPosition = this.camera.position.clone();
		const startLookAt = new THREE.Vector3(0, 0, 0);

		// Sauvegarder la position initiale de la tête
		const headStartPosition = headSegment.position.clone();
		// Position finale de la tête au centre
		const headFinalPosition = new THREE.Vector3(0, 0.4, 0);

		const animateCamera = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Interpolation linéaire de la position
			this.camera.position.lerpVectors(startPosition, finalCameraPosition, progress);

			// Interpolation du point de vue
			const currentLookAt = new THREE.Vector3();
			currentLookAt.lerpVectors(startLookAt, finalCameraLookAt, progress);
			this.camera.lookAt(currentLookAt);

			// Animation de la tête vers le centre
			headSegment.position.lerpVectors(headStartPosition, headFinalPosition, progress);

			if (progress < 1) {
				requestAnimationFrame(animateCamera);
			}
		};

		animateCamera();

		// Déplacer le classement vers la position menu
		this.positionLeaderboard(false);

		// Mettre à jour le score du joueur
		console.log('Envoi du score:', this.score);

		fetch('/api/snake/update-score/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify({score: this.score})
		})
		.then(response => {
			console.log('Statut de la réponse:', response.status);
			if (!response.ok) {
				return response.text().then(text => {
					console.error('Réponse du serveur:', text);
					if (response.status === 401) {
						throw new Error('Non authentifié - veuillez vous reconnecter');
					}
					throw new Error(`Erreur serveur (${response.status}): ${text}`);
				});
			}
			return response.json();
		})
		.then(data => {
			console.log('Score mis à jour avec succès:', data);
			// Rafraîchir le classement après la mise à jour du score
			this.displayLeaderboard();
		})
		.catch(error => {
			console.error('Erreur détaillée:', error);
		});
	}

	animateCameraToCloseUp() {
		const duration = 2000; // 2 secondes
		const startTime = Date.now();
		const startPosition = this.camera.position.clone();
		const finalPosition = new THREE.Vector3(0, 5, 10); // Même position que setupCloseUpView
		const startLookAt = new THREE.Vector3(0, 0, 0);
		const finalLookAt = new THREE.Vector3(0, 0, 0);

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Animation de la position
			this.camera.position.lerpVectors(startPosition, finalPosition, progress);

			// Animation du point de vue
			const currentLookAt = new THREE.Vector3();
			currentLookAt.lerpVectors(startLookAt, finalLookAt, progress);
			this.camera.lookAt(currentLookAt);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	createFinalScore() {
		// Supprimer l'ancien score s'il existe
		if (this.scoreGroup) {
			this.scene.remove(this.scoreGroup);
		}

		// Créer un nouveau groupe pour le score final
		this.scoreGroup = new THREE.Group();
		this.scene.add(this.scoreGroup);

		// Récupérer le meilleur score global
		fetch('/api/snake/high-score/')
			.then(response => response.json())
			.then(data => {
				const loader = new FontLoader();
				loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
					// Créer le texte du score actuel
					const currentScoreGeometry = new TextGeometry(`Votre score: ${this.score}`, {
						font: font,
						size: 0.5,
						height: 0.1,
						curveSegments: 12,
						bevelEnabled: true,
						bevelThickness: 0.02,
						bevelSize: 0.02,
						bevelOffset: 0,
						bevelSegments: 5
					});

					const material = new THREE.MeshStandardMaterial({
						color: 0xffffff,
						roughness: 0.3,
						metalness: 0.8
					});

					const currentScoreMesh = new THREE.Mesh(currentScoreGeometry, material);
					currentScoreMesh.position.set(-2, 1.5, 0);
					currentScoreMesh.rotation.y = Math.PI / 4;

					// Centrer le texte
					currentScoreGeometry.computeBoundingBox();
					const boundingBox = currentScoreGeometry.boundingBox;
					const centerOffset = -(boundingBox.max.x - boundingBox.min.x) / 2;
					currentScoreMesh.position.x += centerOffset;

					this.scoreGroup.add(currentScoreMesh);

					// Afficher le meilleur score personnel si disponible
					if (data.current_user_score !== null) {
						const personalBestGeometry = new TextGeometry(`Votre meilleur score: ${data.current_user_score}`, {
							font: font,
							size: 0.4,
							height: 0.1,
							curveSegments: 12,
							bevelEnabled: true,
							bevelThickness: 0.02,
							bevelSize: 0.02,
							bevelOffset: 0,
							bevelSegments: 5
						});

						const personalBestMesh = new THREE.Mesh(personalBestGeometry, material);
						personalBestMesh.position.set(-2, 0.8, 0);
						personalBestMesh.rotation.y = Math.PI / 4;

						// Centrer le texte
						personalBestGeometry.computeBoundingBox();
						const personalBestBoundingBox = personalBestGeometry.boundingBox;
						const personalBestCenterOffset = -(personalBestBoundingBox.max.x - personalBestBoundingBox.min.x) / 2;
						personalBestMesh.position.x += personalBestCenterOffset;

						this.scoreGroup.add(personalBestMesh);
					}

					// Créer le texte du meilleur score global
					if (data.high_score > 0) {
						const highScoreGeometry = new TextGeometry(`Meilleur score global: ${data.high_score} par ${data.username}`, {
							font: font,
							size: 0.4,
							height: 0.1,
							curveSegments: 12,
							bevelEnabled: true,
							bevelThickness: 0.02,
							bevelSize: 0.02,
							bevelOffset: 0,
							bevelSegments: 5
						});

						const highScoreMesh = new THREE.Mesh(highScoreGeometry, material);
						highScoreMesh.position.set(-2, 0.1, 0);
						highScoreMesh.rotation.y = Math.PI / 4;

						// Centrer le texte
						highScoreGeometry.computeBoundingBox();
						const highScoreBoundingBox = highScoreGeometry.boundingBox;
						const highScoreCenterOffset = -(highScoreBoundingBox.max.x - highScoreBoundingBox.min.x) / 2;
						highScoreMesh.position.x += highScoreCenterOffset;

						this.scoreGroup.add(highScoreMesh);
					}
				});
			})
			.catch(error => {
				console.error('Erreur lors de la récupération du meilleur score:', error);
			});
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

    setupCloseUpView() {
        // Positionner la caméra pour une vue rapprochée du serpent
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);
    }

    animateCameraTransition() {
        const duration = 2000; // 2 secondes
        const startTime = Date.now();
        const startPosition = this.camera.position.clone();
        const startLookAt = new THREE.Vector3(0, 0, 0);
        const finalLookAt = new THREE.Vector3(0, 0, 0);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Animation de la position
            this.camera.position.lerpVectors(startPosition, this.finalCameraPosition, progress);

            // Animation du point de vue
            const currentLookAt = new THREE.Vector3();
            currentLookAt.lerpVectors(startLookAt, finalLookAt, progress);
            this.camera.lookAt(currentLookAt);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    resetGame() {
        // Ne pas supprimer le classement, juste le repositionner
        if (this.leaderboardGroup) {
            // Repositionner le classement sur le côté droit
            this.positionLeaderboard(true);
        }

        // Réinitialiser l'état du jeu
        this.snake = [{ x: 9, y: 10 }];
        this.direction = { x: 1, y: 0 };
        this.gameOver = false;
        this.gameStarted = true;
        this.score = 0;

        // Initialiser this.food AVANT generateObstacles
        this.food = {
            x: Math.floor(Math.random() * this.tileCount),
            y: Math.floor(Math.random() * this.tileCount)
        };

        // Régénérer les obstacles avec un nombre constant
        this.generateObstacles(20);
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

        // Mettre à jour les yeux pour revenir à la normale
        const headSegment = this.snakeGroup.children[0];
        this.updateEyes(headSegment, false);

        // Mettre à jour le score
        this.updateScore3D();

        // Animer la transition vers la vue de jeu
        this.animateCameraTransition();

        // Démarrer le jeu après la transition
        setTimeout(() => {
            this.startGame();
        }, 2000);
    }

    createDirectionalArrows() {
        // Créer un plan pour les flèches
        const textureLoader = new THREE.TextureLoader();
        const arrowsTexture = textureLoader.load('/static/assets/arrows.png');
        const spaceTexture = textureLoader.load('/static/assets/space.png');

        // Créer les flèches
        const arrowsGeometry = new THREE.PlaneGeometry(5, 5);
        const arrowsMaterial = new THREE.MeshBasicMaterial({
            map: arrowsTexture,
            transparent: true,
            opacity: 0.8
        });

        const arrowsMesh = new THREE.Mesh(arrowsGeometry, arrowsMaterial);
        arrowsMesh.position.set(this.tileCount / 3, 0.1, this.tileCount / 2 + 3);
        arrowsMesh.rotation.x = -Math.PI / 2;

        // Créer la barre espace
        const spaceGeometry = new THREE.PlaneGeometry(5, 1.5);
        const spaceMaterial = new THREE.MeshBasicMaterial({
            map: spaceTexture,
            transparent: true,
            opacity: 0.8
        });

        const spaceMesh = new THREE.Mesh(spaceGeometry, spaceMaterial);
        spaceMesh.position.set(this.tileCount / 10, 0.1, this.tileCount / 2 + 3.5);
        spaceMesh.rotation.x = -Math.PI / 2;

        this.arrowsGroup.add(arrowsMesh);
        this.arrowsGroup.add(spaceMesh);
        this.arrowsGroup.visible = false; // Caché par défaut
    }

    displayLeaderboard() {
        // Supprimer l'ancien classement s'il existe
        if (this.leaderboardGroup) {
            this.scene.remove(this.leaderboardGroup);
        }

        // Créer un nouveau groupe pour le classement
        this.leaderboardGroup = new THREE.Group();
        this.scene.add(this.leaderboardGroup);

        // Récupérer les meilleurs scores
        fetch('/api/snake/high-score/')
            .then(response => response.json())
            .then(data => {
                const loader = new FontLoader();
                loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
                    // Créer le titre
                    const titleGeometry = new TextGeometry('Best Scores', {
                        font: font,
                        size: 0.4,
                        height: 0.01,
                        // curveSegments: 12,
                        // bevelEnabled: true,
                        // bevelThickness: 0.02,
                        // bevelSize: 0.02,
                        // bevelOffset: 0,
                        // bevelSegments: 5
                    });

                    const material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        roughness: 0.3,
                        // metalness: 0.8
                    });

                    const titleMesh = new THREE.Mesh(titleGeometry, material);
                    // Position initiale du titre
                    titleMesh.position.set(0, 0, 0);
                    titleMesh.rotation.y = 0;

                    // Centrer le titre
                    titleGeometry.computeBoundingBox();
                    const titleBoundingBox = titleGeometry.boundingBox;
                    const titleCenterOffset = -(titleBoundingBox.max.x - titleBoundingBox.min.x) / 2;
                    titleMesh.position.x += titleCenterOffset;

                    this.leaderboardGroup.add(titleMesh);

                    // Afficher les 5 meilleurs scores
                    const topPlayers = data.players_scores.slice(0, 5);
                    let yOffset = -0.5; // Commencer juste en dessous du titre

                    topPlayers.forEach((player, index) => {
                        const playerText = `${index + 1}. ${player.username}: ${player.score}`;
                        const playerGeometry = new TextGeometry(playerText, {
                            font: font,
                            size: 0.3,
                            height: 0.01,
                            // curveSegments: 12,
                            // bevelEnabled: true,
                            // bevelThickness: 0.02,
                            // bevelSize: 0.02,
                            // bevelOffset: 0,
                            // bevelSegments: 5
                        });

                        const playerMesh = new THREE.Mesh(playerGeometry, material);
                        playerMesh.position.set(0, yOffset, 0);
                        playerMesh.rotation.y = 0;

                        // Centrer le texte
                        playerGeometry.computeBoundingBox();
                        const playerBoundingBox = playerGeometry.boundingBox;
                        const playerCenterOffset = -(playerBoundingBox.max.x - playerBoundingBox.min.x) / 2;
                        playerMesh.position.x += playerCenterOffset;

                        this.leaderboardGroup.add(playerMesh);
                        yOffset -= 0.6; // Espacement entre les lignes
                    });

                    // Afficher le score de l'utilisateur actuel s'il est connecté
                    if (data.current_user_score !== null) {
                        const userText = `Votre meilleur score: ${data.current_user_score}`;
                        const userGeometry = new TextGeometry(userText, {
                            font: font,
                            size: 0.4,
                            height: 0.1,
                            curveSegments: 12,
                            bevelEnabled: true,
                            bevelThickness: 0.02,
                            bevelSize: 0.02,
                            bevelOffset: 0,
                            bevelSegments: 5
                        });

                        const userMesh = new THREE.Mesh(userGeometry, material);
                        userMesh.position.set(0, yOffset - 0.3, 0);
                        userMesh.rotation.y = 0;

                        // Centrer le texte
                        userGeometry.computeBoundingBox();
                        const userBoundingBox = userGeometry.boundingBox;
                        const userCenterOffset = -(userBoundingBox.max.x - userBoundingBox.min.x) / 2;
                        userMesh.position.x += userCenterOffset;

                        this.leaderboardGroup.add(userMesh);
                    }

                    // Positionner le classement selon l'état du jeu
                    this.positionLeaderboard(this.gameStarted && !this.gameOver);
                });
            })
            .catch(error => {
                console.error('Erreur lors de la récupération du classement:', error);
            });
    }

	positionLeaderboard(isGameActive) {
		if (!this.leaderboardGroup) return;

		// Position finale du classement selon l'état du jeu
		const finalPosition = isGameActive
			? new THREE.Vector3(this.tileCount/2 + 2, 5, 0) // Position pendant le jeu
		: new THREE.Vector3(2, 2.5, 4); // Position en menu/fin de partie

		// Rotation finale selon l'état du jeu
		const finalRotation = isGameActive
			? new THREE.Euler(0, -Math.PI / 4, 0) // Rotation pendant le jeu
			: new THREE.Euler(0, -Math.PI / 4, 0); // Pas de rotation en menu/fin de partie

		// Animation du déplacement
		const duration = 1000; // 1 seconde
		const startTime = Date.now();
		const startPosition = this.leaderboardGroup.position.clone();
		const startRotation = this.leaderboardGroup.rotation.clone();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Interpolation linéaire de la position et de la rotation
			this.leaderboardGroup.position.lerpVectors(startPosition, finalPosition, progress);
			this.leaderboardGroup.rotation.x = THREE.MathUtils.lerp(startRotation.x, finalRotation.x, progress);
			this.leaderboardGroup.rotation.y = THREE.MathUtils.lerp(startRotation.y, finalRotation.y, progress);
			this.leaderboardGroup.rotation.z = THREE.MathUtils.lerp(startRotation.z, finalRotation.z, progress);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	createCross() {
		// Créer un groupe pour la croix
		const crossGroup = new THREE.Group();

		// Créer deux cylindres pour former une croix
		const crossGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
		const crossMaterial = new THREE.MeshStandardMaterial({
			color: 0x000000,
			roughness: 0.1,
			metalness: 0.5
		});

		// Cylindre vertical
		const vertical = new THREE.Mesh(crossGeometry, crossMaterial);
		vertical.rotation.x = Math.PI / 2;
		crossGroup.add(vertical);

		// Cylindre horizontal
		const horizontal = new THREE.Mesh(crossGeometry, crossMaterial);
		horizontal.rotation.z = Math.PI / 2;
		crossGroup.add(horizontal);

		return crossGroup;
	}
}

// Initialiser le jeu au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.snakeGame = new Snake3D();
});

window.Snake3D = Snake3D;
