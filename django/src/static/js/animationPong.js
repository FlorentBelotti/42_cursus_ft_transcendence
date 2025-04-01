class PongAnimation {
	constructor() {
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'pong-canvas';
		this.canvas.style.position = 'absolute';
		this.canvas.style.top = '0';
		this.canvas.style.left = '0';
		document.querySelector('.pong-container').appendChild(this.canvas);

		this.ctx = this.canvas.getContext('2d');

		this.noiseCanvas = document.querySelector('.noise-canvas');
        this.noiseCtx = this.noiseCanvas.getContext('2d');
        this.noiseCanvas.style.position = 'absolute';
        this.noiseCanvas.style.top = '0';
        this.noiseCanvas.style.left = '0';
        this.noiseCanvas.style.opacity = '0.07';

		this.state = {
			leftPaddle: { y: 0, targetY: 0, lastTargetUpdate: 0 },
			rightPaddle: { y: 0, targetY: 0, lastTargetUpdate: 0 },
			ball: {
				x: 0,
				y: 0,
				speedX: 0,
				speedY: 0
			},
			lastTime: performance.now()
		};

		this.config = {
			ball: {
				radius: 10,
				baseSpeed: 4,
				color: 'white'
			},
			paddles: {
				width: 20,
				height: 100,
				speed: 8,
				color: 'white',
				reactionTime: 0.05,
				maxOffset: 40,
				targetUpdateInterval: 500
			}
		};
		this.titleElement = document.querySelector('.main-title');

		this.resizeCanvas();
		this.resetGame();
		window.addEventListener('resize', () => this.resizeCanvas());
		this.animate();
	}

	resizeCanvas() {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.noiseCanvas.width = window.innerWidth;
        this.noiseCanvas.height = window.innerHeight;
		if (this.state) {
			this.resetBall();
		}
	}

	resetGame() {
		this.state.leftPaddle.y = this.canvas.height / 2 - this.config.paddles.height / 2;
		this.state.rightPaddle.y = this.canvas.height / 2 - this.config.paddles.height / 2;
		this.state.leftPaddle.targetY = this.state.leftPaddle.y;
		this.state.rightPaddle.targetY = this.state.rightPaddle.y;
		this.resetBall();
	}

	resetBall() {
		this.state.ball = {
			x: this.canvas.width / 2,
			y: this.canvas.height / 2,
			speedX: this.config.ball.baseSpeed * (Math.random() > 0.5 ? 1 : -1),
			speedY: this.config.ball.baseSpeed * (Math.random() - 0.5) * 2
		};
	}

	predictImpact(paddleX) {
		const { ball } = this.state;
		if (ball.speedX === 0) return this.canvas.height / 2;

		const timeToReach = (paddleX - ball.x) / ball.speedX;
		let predictedY = ball.y + ball.speedY * timeToReach;

		while (predictedY < 0 || predictedY > this.canvas.height) {
			predictedY = predictedY < 0 ? -predictedY : 2 * this.canvas.height - predictedY;
		}

		return predictedY;
	}

	updatePaddles(currentTime) {
		const { paddles } = this.config;
		const { leftPaddle, rightPaddle } = this.state;

		const updateTargetIfNeeded = (paddle, paddleX) => {
			if (currentTime - paddle.lastTargetUpdate >= paddles.targetUpdateInterval) {
				const predictedY = this.predictImpact(paddleX);
				const offset = (Math.random() - 0.5) * 2 * paddles.maxOffset;
				paddle.targetY = predictedY - paddles.height / 2 + offset;
				paddle.lastTargetUpdate = currentTime;
			}
		};

		updateTargetIfNeeded(leftPaddle, 30 + paddles.width);
		leftPaddle.y += (leftPaddle.targetY - leftPaddle.y) * paddles.reactionTime;
		leftPaddle.y = Math.max(0, Math.min(leftPaddle.y, this.canvas.height - paddles.height));

		updateTargetIfNeeded(rightPaddle, this.canvas.width - 50);
		rightPaddle.y += (rightPaddle.targetY - rightPaddle.y) * paddles.reactionTime;
		rightPaddle.y = Math.max(0, Math.min(rightPaddle.y, this.canvas.height - paddles.height));
	}

	updateBall() {
		const { ball } = this.state;
		const { paddles, ball: ballConfig } = this.config;

		ball.x += ball.speedX;
		ball.y += ball.speedY;

		if (ball.y - ballConfig.radius < 0) {
			ball.speedY = -ball.speedY;
			ball.y = ballConfig.radius;
		} else if (ball.y + ballConfig.radius > this.canvas.height) {
			ball.speedY = -ball.speedY;
			ball.y = this.canvas.height - ballConfig.radius;
		}

		const checkCollision = (paddle, isLeft) => {
			const paddleX = isLeft ? 30 : this.canvas.width - 50;
			const paddleRight = paddleX + paddles.width;
			const ballLeft = ball.x - ballConfig.radius;
			const ballRight = ball.x + ballConfig.radius;
			const ballTop = ball.y - ballConfig.radius;
			const ballBottom = ball.y + ballConfig.radius;
			const paddleTop = paddle.y;
			const paddleBottom = paddle.y + paddles.height;

			if (
				(isLeft && ballLeft <= paddleRight && ballRight >= paddleX) ||
				(!isLeft && ballRight >= paddleX && ballLeft <= paddleRight)
			) {
				if (ballBottom >= paddleTop && ballTop <= paddleBottom) {
					const impact = ball.y - (paddle.y + paddles.height / 2);
					const normalizeImpact = impact / (paddles.height / 2);
					const bounceAngle = normalizeImpact * (Math.PI / 3);

					const direction = isLeft ? 1 : -1;
					const speed = ballConfig.baseSpeed + Math.abs(ball.speedX) * 0.1;
					ball.speedX = direction * Math.cos(bounceAngle) * speed;
					ball.speedY = Math.sin(bounceAngle) * speed;

					ball.x = isLeft ? paddleRight + ballConfig.radius : paddleX - ballConfig.radius;
					return true;
				}
			}
			return false;
		};

		if (!checkCollision(this.state.leftPaddle, true) && !checkCollision(this.state.rightPaddle, false)) {
			if (ball.x < 0 || ball.x > this.canvas.width) {
				this.resetBall();
			}
		}
	}

	generateNoise() {
        const width = this.noiseCanvas.width;
        const height = this.noiseCanvas.height;
        const imageData = this.noiseCtx.createImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const value = Math.random() * 255; // Valeur aléatoire entre 0 et 255
            data[i] = value;     // Rouge
            data[i + 1] = value; // Vert
            data[i + 2] = value; // Bleu
            data[i + 3] = 255;   // Alpha (opacité complète, contrôlée par CSS)
        }

        this.noiseCtx.putImageData(imageData, 0, 0);
    }

	draw() {
		const { ball, paddles } = this.config;
		const { leftPaddle, rightPaddle, ball: ballState } = this.state;

		this.ctx.fillStyle = '#0d0d0d';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.fillStyle = paddles.color;
		this.ctx.fillRect(30, leftPaddle.y, paddles.width, paddles.height);
		this.ctx.fillRect(this.canvas.width - 50, rightPaddle.y, paddles.width, paddles.height);

		this.ctx.fillStyle = ball.color;
		this.ctx.beginPath();
		this.ctx.arc(ballState.x, ballState.y, ball.radius, 0, Math.PI * 2);
		this.ctx.fill();
	}

	animate(currentTime = 0) {
		const deltaTime = Math.min(currentTime - this.state.lastTime, 100) / 16;
		this.state.lastTime = currentTime;

		this.updatePaddles(currentTime);
		this.updateBall();
		this.generateNoise();
		this.draw();
		requestAnimationFrame((t) => this.animate(t));
	}
}

document.addEventListener('DOMContentLoaded', () => {
	if (document.querySelector('.pong-container')) {
		new PongAnimation();
	} else {
		console.error('Le conteneur .pong-container est introuvable');
	}
});
