import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';


class Snake3D {
	/**
	 * ╔══════════════════════════════════════════════════════════╗
	 * ║                      SnakeGameplay                       ║
	 * ╠══════════════════════════════════════════════════════════╣
	 * ║ Snake Gameplay                                           ║
	 * ║                                                          ║
	 * ║ • Initialization game parameters                         ║
	 * ║ • Setup the parameters of ThreeJS                        ║
	 * ║ • Create Snake                                           ║
	 * ║ • Create Food and Obstacles                              ║
	 * ║ • Handle Leaderboard and scores                          ║
	 * ║ • Handle Camera position                                 ║
	 * ║ • Handle State Game                                      ║
	 * ╚══════════════════════════════════════════════════════════╝
	 */

	//==========================================================//
	//                   INITIALIZATION                         //
	//==========================================================//

	constructor() {
		this.initSnake();
	 }

	initSnake() {
		// Configuration Gameplay
		console.log('[SNAKE]: THREE namespace:', THREE);
		console.log('[SNAKE]: FontLoader:', FontLoader);

		this.gridSize = 20;
		this.tileCount = 20;
		this.gameStarted = false;
		this.paused = false;
		this.gameOver = false;
		this.score = 0;

		// State Snake, Food and Obstacles
		this.snake = [{ x: 9, y: 10 }];
		this.direction = { x: 1, y: 0 };
		this.food = {
			x: Math.floor(Math.random() * this.tileCount),
			y: Math.floor(Math.random() * this.tileCount)
		};

		this.obstacles = [];
		const obstacleCount = 20;
		this.generateObstacles(obstacleCount);

		// Initialization Three.js
		this.setupThreeJS();
		this.createGrid();
		this.createSnake();
		this.createFood();
		this.createObstacles();
		this.setupLights();
		this.setupEventListeners();

		// Creation 3D score
		this.updateScore3D();
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

				for (const segment of this.snake) {
					if (segment.x === obstacleX && segment.y === obstacleY) {
						validPosition = false;
						break;
					}
				}

				if (this.food && this.food.x === obstacleX && this.food.y === obstacleY) {
					validPosition = false;
				}

				const headDistance = Math.sqrt(
					Math.pow(this.snake[0].x - obstacleX, 2) +
					Math.pow(this.snake[0].y - obstacleY, 2)
				);
				if (headDistance < 5) {
					validPosition = false;
				}

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

	//==========================================================//
	//                        SETUP                             //
	//==========================================================//

	createGradientTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;

		const context = canvas.getContext('2d');

		const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, '#0a0a0a');
		gradient.addColorStop(0.5, '#0d0d0d');
		gradient.addColorStop(1, '#181818');

		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);
		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}

	setupThreeJS() {
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
		const gridHelper = new THREE.GridHelper(
			this.tileCount,
			this.tileCount,
			0xffffff,
			0xffffff
		);
		gridHelper.position.y = -0.1;
		this.scene.add(gridHelper);
	}

	setupLights() {
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
		directionalLight.position.set(15, 25, 15);
		directionalLight.castShadow = true;

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

		const backLight = new THREE.DirectionalLight(0xE3F2FD, 0.3);
		backLight.position.set(-10, 15, -10);
		this.scene.add(backLight);

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

	createDirectionalArrows() {
		const textureLoader = new THREE.TextureLoader();
		const arrowsTexture = textureLoader.load('/static/assets/arrows.png');
		const spaceTexture = textureLoader.load('/static/assets/space.png');

		const arrowsGeometry = new THREE.PlaneGeometry(5, 5);
		const arrowsMaterial = new THREE.MeshBasicMaterial({
			map: arrowsTexture,
			transparent: true,
			opacity: 0.8
		});

		const arrowsMesh = new THREE.Mesh(arrowsGeometry, arrowsMaterial);
		arrowsMesh.position.set(this.tileCount / 3, 0.1, this.tileCount / 2 + 3);
		arrowsMesh.rotation.x = -Math.PI / 2;

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
		this.arrowsGroup.visible = false;
	}

	//==========================================================//
	//                     CREATE SNAKE                         //
	//==========================================================//

	createEyes(isDead = false) {
		const eyeGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.85, 32, 4);
		const eyeMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.2,
			metalness: 0.1
		});
		const eyeball = new THREE.Mesh(eyeGeometry, eyeMaterial);
		eyeball.castShadow = true;

		if (isDead) {
			const crossGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
			const crossMaterial = new THREE.MeshStandardMaterial({
				color: 0x000000,
				roughness: 0.1,
				metalness: 0.5
			});

			const leftCross = new THREE.Group();
			const leftVertical = new THREE.Mesh(crossGeometry, crossMaterial);
			const leftHorizontal = new THREE.Mesh(crossGeometry, crossMaterial);
			leftVertical.rotation.x = Math.PI / 2;
			leftHorizontal.rotation.z = Math.PI / 2;
			leftCross.add(leftVertical);
			leftCross.add(leftHorizontal);
			leftCross.position.set(0, 0.4, 0);
			leftCross.rotation.y = Math.PI / 4;
			eyeball.add(leftCross);

			const rightCross = new THREE.Group();
			const rightVertical = new THREE.Mesh(crossGeometry, crossMaterial);
			const rightHorizontal = new THREE.Mesh(crossGeometry, crossMaterial);
			rightVertical.rotation.x = Math.PI / 2;
			rightHorizontal.rotation.z = Math.PI / 2;
			rightCross.add(rightVertical);
			rightCross.add(rightHorizontal);
			rightCross.position.set(0, -0.4, 0);
			rightCross.rotation.y = Math.PI / 4;
			eyeball.add(rightCross);
		} else {
			const pupilGeometry = new THREE.SphereGeometry(0.1, 16, 16);
			const pupilMaterial = new THREE.MeshStandardMaterial({
				color: 0x000000,
				roughness: 0.1,
				metalness: 0.5
			});

			const pupilLeft = new THREE.Mesh(pupilGeometry, pupilMaterial);
			pupilLeft.position.set(0, 0.4, 0);
			eyeball.add(pupilLeft);

			const pupilRight = new THREE.Mesh(pupilGeometry, pupilMaterial);
			pupilRight.position.set(0, -0.4, 0);
			eyeball.add(pupilRight);
		}
		eyeball.rotation.x = Math.PI / 2;
		return eyeball;
	}

	createMouth() {
		const mouthGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.2, 2, 2, 2);
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
			color: isHead ? 0x006947 : 0x01B27B,
			roughness: 0.2,
			metalness: 0.3,
			emissive: isHead ? 0x003D1F : 0x004D26,
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

	createConnector(positionA, positionB) {
		const midX = (positionA.x + positionB.x) / 2;
		const midY = (positionA.y + positionB.y) / 2;

		const diffX = positionB.x - positionA.x;
		const diffY = positionB.y - positionA.y;

		const connectorGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6)

		const connectorMaterial = new THREE.MeshStandardMaterial({
			color: 0x02C589,
			roughness: 0.3,
			emissive: 0x220000,
			emissiveIntensity: 0.2
		});

		const connector = new THREE.Mesh(connectorGeometry, connectorMaterial);
		connector.castShadow = true;
		connector.receiveShadow = true;

		connector.position.set(
			(midX - this.tileCount / 2) + 0.5,
			0.4,
			(midY - this.tileCount / 2) + 0.5
		);
		if (Math.abs(diffX) > 0) {
			connector.rotation.z = Math.PI / 2;
		} else if (Math.abs(diffY) > 0) {
			connector.rotation.x = Math.PI / 2;
		}

		return connector;
	}

	createSnake() {
		while (this.snakeGroup.children.length > 0) {
			const child = this.snakeGroup.children[0];
			if (child.geometry) child.geometry.dispose();
			if (child.material) child.material.dispose();
			this.snakeGroup.remove(child);
		}
		for (let i = 0; i < this.snake.length; i++) {
			const isHead = i === 0;
			const mesh = this.createSnakeSegment(this.snake[i], isHead);
			this.snakeGroup.add(mesh);

			if (isHead) {
				this.updateEyes(mesh);
			}
			if (i < this.snake.length - 1) {
				const connector = this.createConnector(this.snake[i], this.snake[i + 1]);
				this.snakeGroup.add(connector);
			}
		}
	}

	updateEyes(headSegment, isDead = false) {
		const eyes = headSegment.children;
		while (eyes.length > 0) {
			headSegment.remove(eyes[0]);
		}
		const eyeMesh = this.createEyes(isDead);
		const mouth = this.createMouth();

		if (this.direction.x === 1) {
			eyeMesh.rotation.y = 0;
			eyeMesh.rotation.z = 0;
			mouth.position.set(0.4, -0.2, 0);
			mouth.rotation.y = Math.PI / 2;
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.x === -1) {
			eyeMesh.rotation.y = Math.PI;
			eyeMesh.rotation.z = 0;
			mouth.position.set(-0.4, -0.2, 0);
			mouth.rotation.y = -Math.PI / 2;
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.y === 1) {
			eyeMesh.rotation.z = Math.PI / 2;
			mouth.position.set(0, -0.2, 0.4);
			mouth.rotation.z = Math.PI / 2;
		} else if (this.direction.y === -1) {
			eyeMesh.rotation.z = -Math.PI / 2;
			mouth.position.set(0, -0.2, -0.4);
			mouth.rotation.z = -Math.PI / 2;
		}

		headSegment.add(eyeMesh);
		headSegment.add(mouth);
	}

	moveSnake() {
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
			if (this.score % 5 === 0) {
				for (let i = 0; i < 3; i++) {
					this.addNewObstacle();
				}
			}
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

	createCross() {
		const crossGroup = new THREE.Group();
		const crossGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
		const crossMaterial = new THREE.MeshStandardMaterial({
			color: 0x000000,
			roughness: 0.1,
			metalness: 0.5
		});
		const vertical = new THREE.Mesh(crossGeometry, crossMaterial);
		vertical.rotation.x = Math.PI / 2;
		crossGroup.add(vertical);
		const horizontal = new THREE.Mesh(crossGeometry, crossMaterial);
		horizontal.rotation.z = Math.PI / 2;
		crossGroup.add(horizontal);

		return crossGroup;
	}

	//==========================================================//
	//                   CREATE FOOD OBSTACLE                   //
	//==========================================================//

	createFood() {
		const foodGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
		const foodMaterial = new THREE.MeshStandardMaterial({
			color: 0xFF5252,
			roughness: 0.5,
			metalness: 0.2,
			emissive: 0xFF1744,
			emissiveIntensity: 0.1
		});
		this.foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
		this.foodMesh.castShadow = true;
		this.foodMesh.receiveShadow = true;
		this.updateFoodPosition();
		this.scene.add(this.foodMesh);
	}

	updateFoodPosition() {
		this.foodMesh.position.set(
			(this.food.x - this.tileCount / 2) + 0.5,
			0.3,
			(this.food.y - this.tileCount / 2) + 0.5
		);
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
			for (const obstacle of this.obstacles) {
				if (obstacle.x === newObstacle.x && obstacle.y === newObstacle.y) {
					validPosition = false;
					break;
				}
			}
			for (const segment of this.snake) {
				if (segment.x === newObstacle.x && segment.y === newObstacle.y) {
					validPosition = false;
					break;
				}
			}
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
			for (const obstacle of this.obstacles) {
				if (obstacle.x === this.food.x && obstacle.y === this.food.y) {
					validPosition = false;
					break;
				}
			}
			for (const segment of this.snake) {
				if (segment.x === this.food.x && segment.y === this.food.y) {
					validPosition = false;
					break;
				}
			}
		}
	}


	//==========================================================//
	//                     LEADERBOARD                          //
	//==========================================================//

	updateScore3D() {
		if (this.scoreGroup) {
			this.scene.remove(this.scoreGroup);
		}
		this.scoreGroup = new THREE.Group();
		this.scene.add(this.scoreGroup);

		const loader = new FontLoader();
		loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
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
			});

			const scoreMesh = new THREE.Mesh(scoreGeometry, material);
			scoreMesh.position.set(0, 2, -this.tileCount/2 );
			scoreMesh.rotation.y = 0;
			scoreGeometry.computeBoundingBox();
			const scoreBoundingBox = scoreGeometry.boundingBox;
			const scoreCenterOffset = -(scoreBoundingBox.max.x - scoreBoundingBox.min.x) / 2;
			scoreMesh.position.x += scoreCenterOffset;
			this.scoreGroup.add(scoreMesh);
		});
	}

	createFinalScore() {
		if (this.scoreGroup) {
			this.scene.remove(this.scoreGroup);
		}
		this.scoreGroup = new THREE.Group();
		this.scene.add(this.scoreGroup);
		fetch('/api/snake/high-score/')
			.then(response => response.json())
			.then(data => {
				const loader = new FontLoader();
				loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
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
					currentScoreGeometry.computeBoundingBox();
					const boundingBox = currentScoreGeometry.boundingBox;
					const centerOffset = -(boundingBox.max.x - boundingBox.min.x) / 2;
					currentScoreMesh.position.x += centerOffset;

					this.scoreGroup.add(currentScoreMesh);
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

						personalBestGeometry.computeBoundingBox();
						const personalBestBoundingBox = personalBestGeometry.boundingBox;
						const personalBestCenterOffset = -(personalBestBoundingBox.max.x - personalBestBoundingBox.min.x) / 2;
						personalBestMesh.position.x += personalBestCenterOffset;

						this.scoreGroup.add(personalBestMesh);
					}
					if (data.high_score > 0) {
						const highScoreGeometry = new TextGeometry(`Best global score: ${data.high_score} by ${data.username}`, {
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

	displayLeaderboard() {
		if (this.leaderboardGroup) {
			this.scene.remove(this.leaderboardGroup);
		}
		this.leaderboardGroup = new THREE.Group();
		this.scene.add(this.leaderboardGroup);

		fetch('/api/snake/high-score/')
			.then(response => response.json())
			.then(data => {
				const loader = new FontLoader();
				loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
					const titleGeometry = new TextGeometry('Best Scores', {
						font: font,
						size: 0.4,
						height: 0.01,
					});

					const material = new THREE.MeshStandardMaterial({
						color: 0xffffff,
						roughness: 0.3,
					});

					const titleMesh = new THREE.Mesh(titleGeometry, material);
					titleMesh.position.set(0, 0, 0);
					titleMesh.rotation.y = 0;

					titleGeometry.computeBoundingBox();
					const titleBoundingBox = titleGeometry.boundingBox;
					const titleCenterOffset = -(titleBoundingBox.max.x - titleBoundingBox.min.x) / 2;
					titleMesh.position.x += titleCenterOffset;

					this.leaderboardGroup.add(titleMesh);

					const topPlayers = data.players_scores.slice(0, 5);
					let yOffset = -0.5;

					topPlayers.forEach((player, index) => {
						const playerText = `${index + 1}. ${player.username}: ${player.score}`;
						const playerGeometry = new TextGeometry(playerText, {
							font: font,
							size: 0.3,
							height: 0.01,
						});

						const playerMesh = new THREE.Mesh(playerGeometry, material);
						playerMesh.position.set(0, yOffset, 0);
						playerMesh.rotation.y = 0;

						playerGeometry.computeBoundingBox();
						const playerBoundingBox = playerGeometry.boundingBox;
						const playerCenterOffset = -(playerBoundingBox.max.x - playerBoundingBox.min.x) / 2;
						playerMesh.position.x += playerCenterOffset;

						this.leaderboardGroup.add(playerMesh);
						yOffset -= 0.6;
					});

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

						userGeometry.computeBoundingBox();
						const userBoundingBox = userGeometry.boundingBox;
						const userCenterOffset = -(userBoundingBox.max.x - userBoundingBox.min.x) / 2;
						userMesh.position.x += userCenterOffset;

						this.leaderboardGroup.add(userMesh);
					}
					this.positionLeaderboard(this.gameStarted && !this.gameOver);
				});
			})
			.catch(error => {
				console.error('Erreur lors de la récupération du classement:', error);
			});


	}

	positionLeaderboard(isGameActive) {
		if (!this.leaderboardGroup) return;
		const finalPosition = isGameActive ? new THREE.Vector3(this.tileCount/2 + 2, 5, 0) : new THREE.Vector3(2, 2.5, 4);

		const finalRotation = isGameActive ? new THREE.Euler(0, -Math.PI / 4, 0) : new THREE.Euler(0, -Math.PI / 4, 0);

		const duration = 1000;
		const startTime = Date.now();
		const startPosition = this.leaderboardGroup.position.clone();
		const startRotation = this.leaderboardGroup.rotation.clone();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

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

	//==========================================================//
	//                        CAMERA                            //
	//==========================================================//

	moveLeaderboardToCamera() {
		if (!this.leaderboardGroup) return;

		const finalPosition = new THREE.Vector3(0, 0, -5);
		const finalRotation = new THREE.Euler(0, 0, 0);

		const duration = 1000;
		const startTime = Date.now();
		const startPosition = this.leaderboardGroup.position.clone();
		const startRotation = this.leaderboardGroup.rotation.clone();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

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

	animateCameraToCloseUp() {
		const duration = 2000;
		const startTime = Date.now();
		const startPosition = this.camera.position.clone();
		const finalPosition = new THREE.Vector3(0, 5, 10);
		const startLookAt = new THREE.Vector3(0, 0, 0);
		const finalLookAt = new THREE.Vector3(0, 0, 0);

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			this.camera.position.lerpVectors(startPosition, finalPosition, progress);

			const currentLookAt = new THREE.Vector3();
			currentLookAt.lerpVectors(startLookAt, finalLookAt, progress);
			this.camera.lookAt(currentLookAt);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	disposeObject(obj) {
		if (obj.geometry) {
			obj.geometry.dispose();
		}
		if (obj.material) {
			if (Array.isArray(obj.material)) {
				obj.material.forEach(mat => mat.dispose());
			} else {
				obj.material.dispose();
			}
		}
		if (obj.texture) {
			obj.texture.dispose();
		}
		if (obj.children) {
			obj.children.forEach(child => this.disposeObject(child));
		}
	}

	setupCloseUpView() {
		this.camera.position.set(0, 5, 10);
		this.camera.lookAt(0, 0, 0);
	}

	animateCameraTransition() {
		const duration = 2000;
		const startTime = Date.now();
		const startPosition = this.camera.position.clone();
		const startLookAt = new THREE.Vector3(0, 0, 0);
		const finalLookAt = new THREE.Vector3(0, 0, 0);

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			this.camera.position.lerpVectors(startPosition, this.finalCameraPosition, progress);

			const currentLookAt = new THREE.Vector3();
			currentLookAt.lerpVectors(startLookAt, finalLookAt, progress);
			this.camera.lookAt(currentLookAt);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	//==========================================================//
	//                       STATE GAME                         //
	//==========================================================//

	startGame() {
		if (!this.gameLoop) {
			this.arrowsGroup.visible = true;

			this.animateCameraTransition();
			this.positionLeaderboard(true);
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
		if (!this.snake || this.snake.length === 0 || !this.renderer) {
			console.warn("Game state is invalid, stopping game loop.");
			clearInterval(this.gameLoop);
			this.gameLoop = null;
			return;
		}

		if (this.checkCollision()) {
			this.gameOver = true;
			clearInterval(this.gameLoop);
			this.gameLoop = null;
			return;
		}
		this.moveSnake();
	}

	checkCollision() {
		if (!this.snake || this.snake.length === 0) {
			return false;
		}

		const head = this.snake[0];
		if (
			head.x < 0 ||
			head.x >= this.tileCount ||
			head.y < 0 ||
			head.y >= this.tileCount
		) {
			this.handleGameOver();
			return true;
		}
		for (let i = 1; i < this.snake.length; i++) {
			if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
				this.handleGameOver();
				return true;
			}
		}
		for (const obstacle of this.obstacles) {
			if (head.x === obstacle.x && head.y === obstacle.y) {
				this.handleGameOver();
				return true;
			}
		}

		return false;
	}

	handleGameOver() {
		this.gameOver = true;
		clearInterval(this.gameLoop);
		this.gameLoop = null;

		const headSegment = this.snakeGroup.children[0];
		this.updateEyes(headSegment, true);

		const finalCameraPosition = new THREE.Vector3(0, 5, 10);
		const finalCameraLookAt = new THREE.Vector3(0, 0, 0);

		const duration = 1000;
		const startTime = Date.now();
		const startPosition = this.camera.position.clone();
		const startLookAt = new THREE.Vector3(0, 0, 0);

		const headStartPosition = headSegment.position.clone();
		const headFinalPosition = new THREE.Vector3(0, 0.4, 0);

		const animateCamera = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			this.camera.position.lerpVectors(startPosition, finalCameraPosition, progress);

			const currentLookAt = new THREE.Vector3();
			currentLookAt.lerpVectors(startLookAt, finalCameraLookAt, progress);
			this.camera.lookAt(currentLookAt);

			headSegment.position.lerpVectors(headStartPosition, headFinalPosition, progress);

			if (progress < 1) {
				requestAnimationFrame(animateCamera);
			}
		};

		animateCamera();

		this.positionLeaderboard(false);
		console.log('[SNAKE]: Envoi du score:', this.score);

		fetch('/api/snake/update-score/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify({score: this.score})
		})
		.then(response => {
			console.log('[SNAKE]: Statut de la réponse:', response.status);
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
			console.log('[SNAKE]: Score mis à jour avec succès:', data);
			this.displayLeaderboard();
		})
		.catch(error => {
			console.error('Erreur détaillée:', error);
		});
	}

	animate() {
		if (!this.renderer) return;

		this.animationFrameId = requestAnimationFrame(() => this.animate());
		this.renderer.render(this.scene, this.camera);
	}

	cleanup() {
		console.log('[Snake3D]: Starting cleanup...');

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
			this.keydownHandler = null;
		}
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
		}

		if (this.scene) {
			while (this.scene.children.length > 0) {
				const child = this.scene.children[0];
				this.disposeObject(child);
				this.scene.remove(child);
			}
		}

		if (this.renderer) {
			if (this.renderer.domElement && this.renderer.domElement.parentNode) {
				this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
			}
			this.renderer.forceContextLoss();
			this.renderer.dispose();
			this.renderer = null;
		}
		this.scene = null;
		this.camera = null;
		this.snakeGroup = null;
		this.foodMesh = null;
		this.obstaclesGroup = null;
		this.scoreGroup = null;
		this.leaderboardGroup = null;
		this.arrowsGroup = null;
		this.gameStarted = false;
		this.paused = false;
		this.gameOver = false;
		this.score = 0;
		this.snake = [];
		this.food = null;
		this.obstacles = [];

		window.snakeGame = null;
		console.log('[Snake3D]: Cleanup completed.');
	}

	resetGame() {
		if (this.leaderboardGroup) {
			this.positionLeaderboard(true);
		}

		this.snake = [{ x: 9, y: 10 }];
		this.direction = { x: 1, y: 0 };
		this.gameOver = false;
		this.gameStarted = true;
		this.score = 0;

		this.food = {
			x: Math.floor(Math.random() * this.tileCount),
			y: Math.floor(Math.random() * this.tileCount)
		};

		this.generateObstacles(20);
		this.createObstacles();

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
		const headSegment = this.snakeGroup.children[0];
		this.updateEyes(headSegment, false);
		this.updateScore3D();
		this.animateCameraTransition();
		setTimeout(() => {
			this.startGame();
		}, 2000);
	}
}

window.Snake3D = Snake3D;
