class PongGame {
	constructor() {
		this.canvas = document.getElementById('pong');
		this.ctx = this.canvas.getContext('2d');
		this.isGameRunning = false;
		this.requestID = null;
		this.ballTouched = false;

		// PAD PARAMS
		this.padWidth = 20;
		this.padHeight = 90;
		this.padSpeed = 7;
		this.pad1 = { x: 10, y: 255 };
		this.pad2 = { x: 770, y: 255 };
		this.direction1 = 0;
		this.direction2 = 0;

		// BALL PARAMS
		this.ballWidth = 15;
		this.ballHeight = 15;
		this.ball = {
			x: this.canvas.width / 2 - this.ballWidth / 2,
			y: this.canvas.height / 2 - this.ballHeight / 2,
			ballSpeed: 3
		};
		this.directionBall = {
			x: Math.random() < 0.5 ? -1 : 1,
			y: Math.random() < 0.5 ? -1 : 1,
		};

		// SCORE
		this.score = { score1: 0, score2: 0 };

		this.init();
	}

	init() {
		this.startGameLoop();

		document.addEventListener('keydown', (event) => this.handleKeyDown(event));
		document.addEventListener('keyup', (event) => this.handleKeyUp(event));
	}

	handleKeyDown(event) {
			switch (event.key) {
				case 'ArrowUp':
					this.direction2 = -1;
					break;
				case 'ArrowDown':
					this.direction2 = 1;
					break;
				case 'z':
					this.direction1 = -1;
					break;
				case 's':
					this.direction1 = 1;
			}
	}

	handleKeyUp(event) {
			switch (event.key) {
				case 'ArrowUp':
				case 'ArrowDown':
					this.direction2 = 0;
					break;
				case 'z':
				case 's':
					this.direction1 = 0;
					break;
			}
	}

	updatePad() {
		this.pad1.y += this.direction1 * this.padSpeed;
		this.pad2.y += this.direction2 * this.padSpeed;

		this.pad1.y = Math.max(0, Math.min(this.pad1.y, this.canvas.height - this.padHeight));
		this.pad2.y = Math.max(0, Math.min(this.pad2.y, this.canvas.height - this.padHeight));
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw Pad
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(this.pad1.x, this.pad1.y, this.padWidth, this.padHeight);
		this.ctx.fillRect(this.pad2.x, this.pad2.y, this.padWidth, this.padHeight);

		// Draw Ball
		this.ctx.fillRect(this.ball.x, this.ball.y, this.ballWidth, this.ballHeight);
	}

	collisionWall() {
		if (this.ball.y <= 0 || this.ball.y >= this.canvas.height - this.ballHeight) {
			this.directionBall.y *= -1;
		}
	}

	collissionWithPad() {
		// Collision Pad1
		if (this.ball.x <= this.pad1.x + this.padWidth && this.ball.x >= this.pad1.x &&
			this.ball.y + this.ballHeight >= this.pad1.y && this.ball.y <= this.pad1.y + this.padHeight) {
			this.handleCollision(this.pad1, 1);
		}

		// Collision Pad2
		if (this.ball.x + this.ballWidth >= this.pad2.x && this.ball.x <= this.pad2.x + this.padWidth &&
			this.ball.y + this.ballHeight >= this.pad2.y && this.ball.y <= this.pad2.y + this.padHeight) {
			this.handleCollision(this.pad2, -1);
		}
	}

	handleCollision(pad, direction) {
		const impact = (this.ball.y + this.ballHeight / 2) - (pad.y + this.padHeight / 2);
		const normalizeImpact = impact / (this.padHeight / 2);
		const bounceAngle = normalizeImpact * (Math.PI / 3);

		this.directionBall.x = direction * Math.cos(bounceAngle);
		this.directionBall.y = Math.sin(bounceAngle);

		const magnitude = Math.sqrt(this.directionBall.x ** 2 + this.directionBall.y ** 2);
		this.directionBall.x /= magnitude;
		this.directionBall.y /= magnitude;

		this.ball.ballSpeed = 4 + (this.count * 0.3);
		this.ball.x = pad.x + (direction === 1 ? this.padWidth + 1 : -this.ballWidth - 1);
		this.ballTouched = true;
	}

	BUTTTTT() {
		if (this.ball.x <= 0) {
			this.resetBall('right');
			this.score.score2 += 1;
		}
		if (this.ball.x >= this.canvas.width) {
			this.resetBall('left');
			this.score.score1 += 1;
		}
	}

	updateBall() {
		this.ball.x += this.directionBall.x * this.ball.ballSpeed;
		if (this.ballTouched) {
			this.ball.y += this.directionBall.y * this.ball.ballSpeed;
		}
		this.collisionWall();
		this.collissionWithPad();
		this.BUTTTTT();
	}

	resetBall(scorer) {
		this.ball.x = this.canvas.width / 2 - this.ballWidth / 2;
		this.ball.y = this.canvas.height / 2 - this.ballHeight / 2;
		this.directionBall.x = scorer === 'left' ? -1 : 1;
		this.directionBall.y = 0;
		this.ball.ballSpeed = 3;
		this.count = 0;
		this.ballTouched = false;
	}

	displayScore() {
		this.ctx.fillStyle = 'blacks';
		this.ctx.textAlign = 'center';
		this.ctx.font = '30px Arial';
		this.ctx.fillText(this.score.score1, this.canvas.width / 2 - 30, 30);
		this.ctx.fillText(":", this.canvas.width / 2, 30);
		this.ctx.fillText(this.score.score2, this.canvas.width / 2 + 30, 30);
	}

	manageScore() {
		if (this.score.score1 === 10) return 'left';
		if (this.score.score2 === 10) return 'right';
		return null;
	}

	displayWinner(winner) {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.font = '50px Arial';
		this.ctx.fillText(`Player ${winner === 'left' ? 1 : 2} wins!`, this.canvas.width / 2, 50);
		this.stopGame();
	}

	updatePad1() {
		this.pad1.y += this.direction1 * this.padSpeed;
		this.pad1.y = Math.max(0, Math.min(this.pad1.y, this.canvas.height - this.padHeight));
	}

	predictBallImpact() {
		if (this.directionBall.x === 0) return this.pad2.y;

		const distanceToPad2 = this.pad2.x - this.ball.x;
		const timeToReachPad2 = distanceToPad2 / (this.directionBall.x * this.ball.ballSpeed);

		let predictedY = this.ball.y + this.directionBall.y * this.ball.ballSpeed * timeToReachPad2;
		let predictedDirectionY = this.directionBall.y;
		let remainingTime = timeToReachPad2;
		let currentY = this.ball.y;

		while (remainingTime > 0) {
			const timeToNextWall = predictedDirectionY > 0 ?
				(this.canvas.height - this.ballHeight - currentY) / (predictedDirectionY * this.ball.ballSpeed) :
				(currentY) / (-predictedDirectionY * this.ball.ballSpeed);

			if (timeToNextWall >= remainingTime) {
				currentY += predictedDirectionY * this.ball.ballSpeed * remainingTime;
				break;
			} else {
				currentY += predictedDirectionY * this.ball.ballSpeed * timeToNextWall;
				predictedDirectionY *= -1;
				remainingTime -= timeToNextWall;
			}
		}

		return currentY - this.padHeight / 2;
	}

	stopGame() {
		if (this.requestID) {
			cancelAnimationFrame(this.requestID);
		}
		this.isGameRunning = false;
		this.requestID = null;
	}

	gameLoop() {
		if (!this.isGameRunning) return;

			this.updatePad();
			this.updateBall();
			this.draw();
			this.displayScore();
			const winner = this.manageScore();
			if (winner) {
				this.displayWinner(winner);
				return;
			}
		this.requestID = requestAnimationFrame(() => this.gameLoop());
	}

	resetGame() {
		this.pad1.y = 255;
		this.pad2.y = 255;
		this.score.score1 = 0;
		this.score.score2 = 0;
		this.ball.x = this.canvas.width / 2 - this.ballWidth / 2;
		this.ball.y = this.canvas.height / 2 - this.ballHeight / 2;
		this.directionBall = {
			x: Math.random() < 0.5 ? -1 : 1,
			y: Math.random() < 0.5 ? -1 : 1,
		};
		this.ball.ballSpeed = 3;
		this.count = 0;
	}

	startGameLoop() {
		if (this.isGameRunning) {
			this.stopGame();
		}
		this.resetGame();
		this.isGameRunning = true;
		this.gameLoop();
	}
}

// Initialiser le jeu Pong
let pongGame;

function initPong() {
	pongGame = new PongGame();
}
