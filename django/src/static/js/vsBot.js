class PongBot {
    constructor() {
        this.canvas = document.getElementById('pong');
        this.ctx = this.canvas.getContext('2d');
        this.isGameRunning = false;
        this.requestID = null;
        this.ballTouched = false;
        this.botRunning = false;
        this.botRequestID = null;

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
        
        // Compteur pour ajuster la vitesse de la balle
        this.count = 0;

        this.init();
    }

    init() {
        this.startGameLoop();
        
        // Lier les méthodes aux événements pour pouvoir les supprimer plus tard
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowUp':
            case 'z':
                this.direction1 = -1;
                break;
            case 'ArrowDown':
            case 's':
                this.direction1 = 1;
                break;
        }
    }

    handleKeyUp(event) {
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'z':
            case 's':
                this.direction1 = 0;
                break;
        }
    }

    updatePad1() {
        this.pad1.y += this.direction1 * this.padSpeed;
        this.pad1.y = Math.max(0, Math.min(this.pad1.y, this.canvas.height - this.padHeight));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Pad
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(this.pad1.x, this.pad1.y, this.padWidth, this.padHeight);
        this.ctx.fillRect(this.pad2.x, this.pad2.y, this.padWidth, this.padHeight);

        // Draw Ball
        this.ctx.fillStyle = 'white';
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

        this.count++;
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
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = '30px Noto';
        this.ctx.fillText(this.score.score1, this.canvas.width / 2 - 30, 30);
        this.ctx.fillText(":", this.canvas.width / 2, 30);
        this.ctx.fillText(this.score.score2, this.canvas.width / 2 + 30, 30);
    }

    manageScore() {
        if (this.score.score1 === 3) return 'left';
        if (this.score.score2 === 3) return 'right';
        return null;
    }

    displayWinner(winner) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '50px Noto';
        this.ctx.fillText(`Player ${winner === 'left' ? 1 : 2} wins!`, this.canvas.width / 2, 50);
        this.stopGame();
    }

    predictBallImpact() {
        if (this.directionBall.x < 0) {
            return this.pad2.y; // Ne rien faire si la balle va vers le joueur
        }

        // Calculer où la balle va toucher le côté droit
        let ballX = this.ball.x;
        let ballY = this.ball.y;
        let dirX = this.directionBall.x;
        let dirY = this.directionBall.y;
        let speed = this.ball.ballSpeed;
        
        // Simuler le mouvement de la balle jusqu'à ce qu'elle atteigne le côté droit
        while (ballX < this.pad2.x) {
            ballX += dirX * speed;
            ballY += dirY * speed;
            
            // Vérifier les collisions avec les murs du haut et du bas
            if (ballY <= 0 || ballY >= this.canvas.height - this.ballHeight) {
                dirY *= -1;
            }
        }
        
        // Ajouter un peu d'imperfection pour rendre le bot plus humain
        const errorFactor = Math.random() * 60 - 30; // Erreur de ±30 pixels
        return ballY - (this.padHeight / 2) + errorFactor;
    }
    
    moveBot() {
        const targetY = this.predictBallImpact();
        const diffY = targetY - this.pad2.y;
        
        // Vitesse adaptative en fonction de la difficulté
        const botSpeed = this.padSpeed * 0.8;
        
        // Mouvement progressif vers la cible
        if (diffY > botSpeed) {
            this.pad2.y += botSpeed;
        } else if (diffY < -botSpeed) {
            this.pad2.y -= botSpeed;
        } else {
            this.pad2.y = targetY;
        }
        
        // S'assurer que le bot ne dépasse pas les limites
        this.pad2.y = Math.max(0, Math.min(this.pad2.y, this.canvas.height - this.padHeight));
    }

    botLoop() {
        if (!this.isGameRunning) {
            this.botRunning = false;
            return;
        }
        
        this.botRunning = true;
        this.moveBot();
        this.botRequestID = setTimeout(() => {
            requestAnimationFrame(() => this.botLoop());
        }, 1000 / 30); // Actualiser l'IA 30 fois par seconde (suffisant pour le bot)
    }

    gameLoop() {
        if (!this.isGameRunning) return;

        this.updatePad1();
        this.moveBot();
        this.updateBall();
        this.draw();
        this.displayScore();
        const winner = this.manageScore();
        if (winner) {
            this.displayWinner(winner);
            return;
        }
        
        // Optimisation pour limiter le taux de rafraîchissement
        this.requestID = setTimeout(() => {
            requestAnimationFrame(() => this.gameLoop());
        }, 1000 / 60); // Limiter à 60 FPS
    }

    stopGame() {
        console.log('[PongBot]: Stopping game');
        
        this.isGameRunning = false;
        this.botRunning = false;
        
        if (this.requestID) {
            clearTimeout(this.requestID);
            cancelAnimationFrame(this.requestID);
            this.requestID = null;
        }
        
        if (this.botRequestID) {
            clearTimeout(this.botRequestID);
            cancelAnimationFrame(this.botRequestID);
            this.botRequestID = null;
        }
        
        this.cleanup();
    }
    
    cleanup() {
        console.log('[PongBot]: Cleaning up resources');
        
        // Supprimer les écouteurs d'événements
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Nettoyer le canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Réinitialiser les flags
        this.isGameRunning = false;
        this.botRunning = false;
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
        if (!this.botRunning) {
            this.botLoop();
        }
        this.gameLoop();
    }
}

function initBot() {
    // Si une instance existe déjà, la nettoyer avant d'en créer une nouvelle
    if (window.PongBot) {
        window.PongBot.stopGame();
        window.PongBot = null;
    }
    window.PongBot = new PongBot();
}
