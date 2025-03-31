class PongAnimation {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'pong-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        document.querySelector('.pong-container').appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        this.state = {
            leftPaddle: { y: 0 },
            rightPaddle: { y: 0 },
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
                reactionTime: 0.05
            }
        };

        this.resizeCanvas(); // Maintenant this.state existe
        this.resetGame(); // Initialise les positions correctement
        window.addEventListener('resize', () => this.resizeCanvas());
        this.animate();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Réinitialiser les positions sans accéder à state.ball directement
        if (this.state) {
            this.resetBall();
        }
    }

    resetGame() {
        this.state.leftPaddle.y = this.canvas.height / 2 - this.config.paddles.height / 2;
        this.state.rightPaddle.y = this.canvas.height / 2 - this.config.paddles.height / 2;
        this.resetBall();
    }

    resetBall() {
        this.state.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            speedX: this.config.ball.baseSpeed * (Math.random() > 0.5 ? 1 : -1),
            speedY: this.config.ball.baseSpeed * (Math.random() - 0.5)
        };
    }

    predictImpact(paddleX) {
        const { ball } = this.state;
        if (ball.speedX === 0) return this.canvas.height / 2;

        const timeToReach = (paddleX - ball.x) / ball.speedX;
        let predictedY = ball.y + ball.speedY * timeToReach;

        // Gestion des rebonds
        while (predictedY < 0 || predictedY > this.canvas.height) {
            predictedY = predictedY < 0 ? -predictedY : 2 * this.canvas.height - predictedY;
        }

        return predictedY - this.config.paddles.height / 2;
    }

    updatePaddles() {
        const { paddles } = this.config;
        const { ball, leftPaddle, rightPaddle } = this.state;

        // Raquette gauche
        const leftTarget = this.predictImpact(paddles.width + 30);
        leftPaddle.y += (leftTarget - leftPaddle.y) * paddles.reactionTime;
        leftPaddle.y = Math.max(0, Math.min(leftPaddle.y, this.canvas.height - paddles.height));

        // Raquette droite
        const rightTarget = this.predictImpact(this.canvas.width - paddles.width - 30);
        rightPaddle.y += (rightTarget - rightPaddle.y) * paddles.reactionTime;
        rightPaddle.y = Math.max(0, Math.min(rightPaddle.y, this.canvas.height - paddles.height));
    }

    updateBall() {
        const { ball } = this.state;
        const { paddles } = this.config;

        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Rebonds haut/bas
        if (ball.y - ball.radius < 0 || ball.y + ball.radius > this.canvas.height) {
            ball.speedY = -ball.speedY;
            ball.y = ball.y < ball.radius ? ball.radius : this.canvas.height - ball.radius;
        }

        // Collisions avec les raquettes
        const checkCollision = (paddle, isLeft) => {
            const paddleX = isLeft ? 30 + paddles.width : this.canvas.width - 30 - paddles.width;
            if ((isLeft && ball.x - ball.radius < paddleX + paddles.width && ball.x + ball.radius > paddleX) ||
                (!isLeft && ball.x + ball.radius > paddleX && ball.x - ball.radius < paddleX + paddles.width)) {

                if (ball.y + ball.radius > paddle.y && ball.y - ball.radius < paddle.y + paddles.height) {
                    const hitPos = ((ball.y - paddle.y) / paddles.height) * 2 - 1;
                    ball.speedY = hitPos * this.config.ball.baseSpeed * 1.5;
                    ball.speedX = (isLeft ? 1 : -1) * Math.abs(ball.speedX) * 1.05;
                    ball.x = isLeft ? paddleX + paddles.width + ball.radius : paddleX - ball.radius;
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

    draw() {
        const { ball, paddles } = this.config;
        const { leftPaddle, rightPaddle, ball: ballState } = this.state;

        // Fond
        this.ctx.fillStyle = '#0d0d0d';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Raquettes
        this.ctx.fillStyle = paddles.color;
        this.ctx.fillRect(30, leftPaddle.y, paddles.width, paddles.height);
        this.ctx.fillRect(this.canvas.width - 50, rightPaddle.y, paddles.width, paddles.height);

        // Balle
        this.ctx.fillStyle = ball.color;
        this.ctx.beginPath();
        this.ctx.arc(ballState.x, ballState.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    animate(currentTime = 0) {
        const deltaTime = Math.min(currentTime - this.state.lastTime, 100) / 16;
        this.state.lastTime = currentTime;

        this.updatePaddles();
        this.updateBall();
        this.draw();
        requestAnimationFrame((t) => this.animate(t));
    }
}

// Initialisation sécurisée
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.pong-container')) {
        new PongAnimation();
    } else {
        console.error('Le conteneur .pong-container est introuvable');
    }
});
