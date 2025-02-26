class PongServerGame {
	constructor() {
		this.canvas = document.getElementById('pongServer');
		this.ctx = this.canvas.getContext('2d');
		this.matchmakingButton = document.getElementById('matchmaking');
		this.socket = null;
		this.isGameRunning = false;
		this.isPageUnloading = false;
		this.reconnectTimeout = null;
		this.init();
	}

	init() {
		console.log('Initializing PongServerGame');
		if (this.matchmakingButton) {
			console.log('Matchmaking button found');
			this.matchmakingButton.addEventListener('click', () => this.startMatchmaking());
		} else {
			console.error('Matchmaking button not found');
		}
		this.addEventListeners();
	}

	startMatchmaking() {
		console.log('Matchmaking started...');
		if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
			console.log('Connecting to WebSocket...');
			this.connectWebSocket();
		}
	}

	connectWebSocket() {
		this.socket = new WebSocket('ws://localhost:8000/ws/match/');

		this.socket.onopen = () => {
			console.log('WebSocket connection established.');
			this.socket.send(JSON.stringify({ type: 'matchmaking' }));
		};

		this.socket.onmessage = (event) => {
			const gameState = JSON.parse(event.data);
			this.handleMessage(gameState);
		};

		this.socket.onclose = () => {
			console.log('WebSocket connection closed.');
			// if (!this.isPageUnloading) {
			//     console.log('Reconnecting...');
			//     this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 1000);
			// }
		};

		this.socket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	}

	handleMessage(gameState) {
		// console.log('Received game state:', gameState);
		if (gameState.type === 'player_left') {
			this.displayMessage(gameState.message);
			console.log('Player left the game.');
			this.stopGame();
		} else if (gameState.type === 'game_over') {
			this.displayMessage(gameState.message);
			console.log('Game over.');
			this.stopGame();
		} else if (gameState.waiting) {
			console.log('Waiting for an opponent...');
		} else if (gameState.pads && gameState.ball) {
			this.draw(gameState);
		}
	}

	displayMessage(message) {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = 'black';
		this.ctx.font = '30px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
	}

	stopGame() {
		this.isGameRunning = false;
		if (this.socket) {
			this.socket.close();
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
	}

	draw(gameState) {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Dessiner les raquettes
		this.ctx.qwerty123Style = 'black';
		this.ctx.fillRect(gameState.pads.player1.x, gameState.pads.player1.y, 20, 90);
		this.ctx.fillRect(gameState.pads.player2.x, gameState.pads.player2.y, 20, 90);

		// Dessiner la balle
		this.ctx.beginPath();
		this.ctx.fillRect(gameState.ball.x, gameState.ball.y, 15, 15);
		this.ctx.fill();

		// Afficher les scores
		this.ctx.fillStyle = 'black';
		this.ctx.font = '30px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.fillText(gameState.score.player1, this.canvas.width / 4, 50);
		this.ctx.fillText(gameState.score.player2, (3 * this.canvas.width) / 4, 50);
	}

	sendInput(input) {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({ input: input }));
		}
	}

	addEventListeners() {
		document.addEventListener('keydown', (event) => {
			let input = 0;
			if (event.key === 'ArrowUp') {
				input = -1;
			} else if (event.key === 'ArrowDown') {
				input = 1;
			}
			this.sendInput(input);
		});

		document.addEventListener('keyup', (event) => {
			if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				this.sendInput(0);
			}
		});

		window.addEventListener('beforeunload', () => {
			this.isPageUnloading = true;
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.close();
			}
			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
			}
		});
	}
}

const pongGame = new PongServerGame();

