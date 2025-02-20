class PongAnimation {
    constructor() {
        this.canvas = document.querySelector('.pong-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Dimensions du canvas
        this.canvasWidth = this.canvas.width;
        this.canvasHeight = this.canvas.height;

        // Configuration de la balle
        this.ballConfig = {
            radius: 10,
            x: this.canvasWidth / 2,
            y: this.canvasHeight / 2,
            speedX: 3,
            speedY: 3,
            color: '#000'
        };

        // Configuration des raquettes
        this.paddleConfig = {
            width: 15,
            height: 80,
            speed: 4, // Vitesse réduite pour un mouvement plus fluide
            color: '#000'
        };

        // Position des raquettes
        this.leftPaddle = {
            y: (this.canvasHeight - this.paddleConfig.height) / 2,
            targetY: (this.canvasHeight - this.paddleConfig.height) / 2
        };

        this.rightPaddle = {
            y: (this.canvasHeight - this.paddleConfig.height) / 2,
            targetY: (this.canvasHeight - this.paddleConfig.height) / 2
        };

        // ID de l'animation
        this.animationId = null;

        // Démarrer l'animation
        this.animate();
    }

    // Prédire la position Y de la balle
    predictBallPosition(paddle, isLeft) {
        const distanceX = isLeft ?
            (this.paddleConfig.width - this.ballConfig.x) :
            (this.canvasWidth - this.paddleConfig.width - this.ballConfig.x);

        if ((isLeft && this.ballConfig.speedX > 0) || (!isLeft && this.ballConfig.speedX < 0)) {
            // Si la balle s'éloigne de la raquette, viser le centre
            return this.canvasHeight / 2 - this.paddleConfig.height / 2;
        }

        // Calculer le temps que mettra la balle pour atteindre la raquette
        const timeToReach = Math.abs(distanceX / this.ballConfig.speedX);

        // Calculer la position Y future de la balle
        let futureY = this.ballConfig.y + (this.ballConfig.speedY * timeToReach);

        // Tenir compte des rebonds sur les bords
        const bounces = Math.floor(futureY / this.canvasHeight);
        if (bounces % 2 === 0) {
            futureY = futureY % this.canvasHeight;
        } else {
            futureY = this.canvasHeight - (futureY % this.canvasHeight);
        }

        // Ajout d'une petite anticipation pour être légèrement en avance
        return futureY - this.paddleConfig.height / 2;
    }

    // Mettre à jour la position des raquettes
    updatePaddles() {
        // Mettre à jour les positions cibles
        this.leftPaddle.targetY = this.predictBallPosition(this.leftPaddle, true);
        this.rightPaddle.targetY = this.predictBallPosition(this.rightPaddle, false);

        // Mouvement fluide vers les positions cibles
        const moveToTarget = (paddle, targetY) => {
            const diff = targetY - paddle.y;
            if (Math.abs(diff) > this.paddleConfig.speed) {
                paddle.y += Math.sign(diff) * this.paddleConfig.speed;
            } else {
                paddle.y = targetY;
            }

            // Garder les raquettes dans les limites du canvas
            paddle.y = Math.max(0, Math.min(paddle.y, this.canvasHeight - this.paddleConfig.height));
        };

        moveToTarget(this.leftPaddle, this.leftPaddle.targetY);
        moveToTarget(this.rightPaddle, this.rightPaddle.targetY);
    }

    drawBall() {
        this.ctx.beginPath();
        this.ctx.arc(
            this.ballConfig.x,
            this.ballConfig.y,
            this.ballConfig.radius,
            0,
            Math.PI * 2
        );
        this.ctx.fillStyle = this.ballConfig.color;
        this.ctx.fill();
        this.ctx.closePath();
    }

    drawPaddles() {
        this.ctx.fillStyle = this.paddleConfig.color;

        // Raquette gauche
        this.ctx.fillRect(
            10,
            this.leftPaddle.y,
            this.paddleConfig.width,
            this.paddleConfig.height
        );

        // Raquette droite
        this.ctx.fillRect(
            this.canvasWidth - this.paddleConfig.width - 10,
            this.rightPaddle.y,
            this.paddleConfig.width,
            this.paddleConfig.height
        );
    }

    updateBall() {
        this.ballConfig.x += this.ballConfig.speedX;
        this.ballConfig.y += this.ballConfig.speedY;

        // Collision avec les bords haut et bas
        if (
            this.ballConfig.y + this.ballConfig.radius > this.canvasHeight ||
            this.ballConfig.y - this.ballConfig.radius < 0
        ) {
            this.ballConfig.speedY = -this.ballConfig.speedY;
        }

        // Collision avec les raquettes
        if (
            (this.ballConfig.x - this.ballConfig.radius < this.paddleConfig.width &&
             this.ballConfig.y > this.leftPaddle.y &&
             this.ballConfig.y < this.leftPaddle.y + this.paddleConfig.height) ||
            (this.ballConfig.x + this.ballConfig.radius > this.canvasWidth - this.paddleConfig.width &&
             this.ballConfig.y > this.rightPaddle.y &&
             this.ballConfig.y < this.rightPaddle.y + this.paddleConfig.height)
        ) {
            this.ballConfig.speedX = -this.ballConfig.speedX;

            // Ajout d'un effet aléatoire léger lors des rebonds
            this.ballConfig.speedY += (Math.random() - 0.5) * 2;

            // Limiter la vitesse verticale
            this.ballConfig.speedY = Math.max(Math.min(this.ballConfig.speedY, 8), -8);
        }

        // Réinitialisation si la balle sort du canvas
        if (
            this.ballConfig.x - this.ballConfig.radius < 0 ||
            this.ballConfig.x + this.ballConfig.radius > this.canvasWidth
        ) {
            this.resetBall();
        }
    }

    resetBall() {
        this.ballConfig.x = this.canvasWidth / 2;
        this.ballConfig.y = this.canvasHeight / 2;
        this.ballConfig.speedX = -this.ballConfig.speedX;
        this.ballConfig.speedY = 4 * (Math.random() - 0.5); // Direction aléatoire
    }

    animate() {
        // Effacer le canvas
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Mettre à jour les positions des raquettes
        this.updatePaddles();

        // Dessiner les éléments
        this.drawBall();
        this.drawPaddles();

        // Mettre à jour la position de la balle
        this.updateBall();

        // Boucler l'animation
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    // Méthode pour arrêter l'animation
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null; // Réinitialiser l'ID
        }
    }
}

// Initialiser l'animation
let pongAnimation;

function initPongAnimation() {
    pongAnimation = new PongAnimation();
}

// Démarrer l'animation quand la page est chargée
document.addEventListener('DOMContentLoaded', initPongAnimation);
