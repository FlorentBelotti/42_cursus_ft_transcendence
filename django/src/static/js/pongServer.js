class PongServerGame {
    constructor() {
        this.canvas = document.getElementById('pongServer');
        this.ctx = this.canvas.getContext('2d');
        this.matchmakingButton = document.getElementById('matchmaking');
        this.socket = null;
        this.isGameRunning = false;
        this.isPageUnloading = false;
        this.reconnectTimeout = null;
        this.playerNumber = null;
        this.playerInfo = {
            player1: { username: "", nickname: "", elo: 0 },
            player2: { username: "", nickname: "", elo: 0}
        };
        this.keysPressed = {};
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
        this.displayWelcomeScreen();
    }

    displayWelcomeScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw title
        this.ctx.fillStyle = '#333';
        this.ctx.font = '36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Pong Match', this.canvas.width / 2, 100);
        
        // Draw instructions
        this.ctx.font = '22px Arial';
        this.ctx.fillText('Click "Lancer la recherche" to find an opponent', this.canvas.width / 2, 160);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Use up/down arrow keys to control your paddle', this.canvas.width / 2, 200);
        
        // Draw player info
        if (currentUser) {
            const displayName = currentUser.nickname || currentUser.username;
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`Player: ${displayName}`, this.canvas.width / 2, 260);
            this.ctx.fillText(`ELO: ${currentUser.elo}`, this.canvas.width / 2, 295);
        }
        
        // Draw pong logo/icon
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.canvas.width/2 - 80, 330, 20, 70);
        this.ctx.fillRect(this.canvas.width/2 + 60, 330, 20, 70);
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width/2, 365, 10, 0, Math.PI * 2);
        this.ctx.fill();
    }

    startMatchmaking() {
        console.log('Matchmaking started...');
        if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
            console.log('Connecting to WebSocket...');
            this.connectWebSocket();
            
            // Update button state
            if (this.matchmakingButton) {
                this.matchmakingButton.disabled = true;
                this.matchmakingButton.textContent = 'Recherche en cours...';
            }
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    connectWebSocket() {
        // Get token from cookie - use your original method
        const token = document.cookie
            .split('; ')
            .find(cookie => cookie.startsWith('access_token='))
            ?.split('=')[1];
            
        // Include token in URL as query parameter
        this.socket = new WebSocket(`ws://${window.location.host}/ws/match/?token=${token}`);
        
        this.socket.onopen = () => {
            console.log('WebSocket connection established.');
            // Immediately send find_match message
            this.socket.send(JSON.stringify({ 
                type: 'find_match',
                user: currentUser
            }));
            
            this.displayMessage('Recherche d\'un adversaire...');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed.');
            this.isGameRunning = false;
            
            // Re-enable matchmaking button
            if (this.matchmakingButton) {
                this.matchmakingButton.disabled = false;
                this.matchmakingButton.textContent = 'Lancer la recherche';
            }
            
            // Only show disconnection message if not during page unload
            if (!this.isPageUnloading) {
                this.displayMessage('Déconnecté du serveur. Veuillez rafraîchir la page.');
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.displayMessage('Erreur de connexion. Veuillez réessayer.');
        };
    }


    handleMessage(data) {
        console.log('Received message:', data);
        
        // Process game-related messages - no authentication check needed
        if (data.type === 'player_left') {
            this.displayMessage(data.message || "Votre adversaire a quitté la partie.");
            console.log('Player left the game.');
            this.stopGame();
        } else if (data.type === 'game_over') {
            this.displayMessage(data.message || "Partie terminée!");
            console.log('Game over.');
            this.stopGame();
        } else if (data.type === 'matchmaking_cancelled') {
            this.displayMessage(data.message || "Recherche annulée.");
            if (this.matchmakingButton) {
                this.matchmakingButton.disabled = false;
                this.matchmakingButton.textContent = 'Lancer la recherche';
            }
        } else if (data.type === 'matchmaking_update' || data.waiting) {
            console.log('Matchmaking status update...');
            this.displayMatchmakingStatus(data);
        } else if (data.type === 'match_created') {
            console.log('Match created!');
            this.isGameRunning = true;
            this.playerNumber = data.player_number;
            
            // Disable matchmaking button during game
            if (this.matchmakingButton) {
                this.matchmakingButton.disabled = true;
                this.matchmakingButton.textContent = 'En jeu...';
            }
            
            if (data.game_state) {
                this.handleGameState(data.game_state);
            }
        } else if (data.type === 'game_update') {
            this.handleGameState(data.game_state);
        } else if (data.pads && data.ball) {
            // For backward compatibility with your original message format
            this.isGameRunning = true;
            if (data.player_info) {
                this.playerInfo.player1 = data.player_info.player1;
                this.playerInfo.player2 = data.player_info.player2;
            }
            this.draw(data);
        }
    }
    
    handleGameState(gameState) {
        if (gameState.player_info) {
            this.playerInfo.player1 = gameState.player_info.player1;
            this.playerInfo.player2 = gameState.player_info.player2;
        }
        this.draw(gameState);
    }

    displayMatchmakingStatus(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message || "Searching for opponent...", this.canvas.width / 2, this.canvas.height / 2 - 40);
        
        const status = data.matchmaking_status || {};
        
        this.ctx.font = '20px Arial';
        if (currentUser && currentUser.elo) {
            this.ctx.fillText(`Your ELO: ${currentUser.elo}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
        }
        
        if (status.wait_time) {
            this.ctx.fillText(`Wait time: ${status.wait_time} seconds`, this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
        
        if (status.queue_position) {
            this.ctx.fillText(`Queue position: ${status.queue_position}`, this.canvas.width / 2, this.canvas.height / 2 + 70);
        }
        
        // Animated dots
        const now = Date.now();
        const dotCount = Math.floor((now % 3000) / 1000) + 1;
        const dots = '.'.repeat(dotCount);
        this.ctx.fillText(`Searching${dots}`, this.canvas.width / 2, this.canvas.height / 2 + 120);
        
        // If we're still searching, schedule the next animation frame
        if (!this.isGameRunning && this.authenticated) {
            setTimeout(() => this.displayMatchmakingStatus(data), 500);
        }
    }

    displayMessage(message) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    stopGame() {
        this.isGameRunning = false;
        this.playerNumber = null;
        
        // Re-enable matchmaking button
        if (this.matchmakingButton) {
            this.matchmakingButton.disabled = false;
            this.matchmakingButton.textContent = 'Lancer la recherche';
        }
    }

    draw(gameState) {
        if (!gameState) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw paddles
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(
            gameState.pads.player1.x, 
            gameState.pads.player1.y, 
            20, 90
        );
        this.ctx.fillRect(
            gameState.pads.player2.x, 
            gameState.pads.player2.y, 
            20, 90
        );
        
        // Draw ball
        this.ctx.fillRect(
            gameState.ball.x, 
            gameState.ball.y, 
            15, 15
        );
        
        // Draw scores
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gameState.score.player1, this.canvas.width / 2 - 30, 30);
        this.ctx.fillText(":", this.canvas.width / 2, 30);
        this.ctx.fillText(gameState.score.player2, this.canvas.width / 2 + 30, 30);
        
        // Draw player names with nicknames if available
        const player1Display = this.playerInfo.player1.nickname || this.playerInfo.player1.username;
        const player2Display = this.playerInfo.player2.nickname || this.playerInfo.player2.username;
        
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${player1Display} (${this.playerInfo.player1.elo})`, 20, 20);
        
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${player2Display} (${this.playerInfo.player2.elo})`, this.canvas.width - 20, 20);
        
        // Request next animation frame
        requestAnimationFrame(() => {
            if (this.isGameRunning) {
                this.draw(gameState);
            }
        });
    }

    sendInput(input) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isGameRunning) {
            this.socket.send(JSON.stringify({ 
                type: 'player_input',
                input: input 
            }));
        }
    }

    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.isGameRunning) return;
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.keysPressed.up = true;
                this.sendInput(-1); // Move up
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.keysPressed.down = true;
                this.sendInput(1); // Move down
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (!this.isGameRunning) return;
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.keysPressed.up = false;
                if (!this.keysPressed.down) {
                    this.sendInput(0);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.keysPressed.down = false;
                if (!this.keysPressed.up) {
                    this.sendInput(0);
                } else {
                    this.sendInput(-1);
                }
            }
        });
        
        // Handle page unload to avoid error messages
        window.addEventListener('beforeunload', () => {
            this.isPageUnloading = true;
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            }
        });
    }
}

const pongGame = new PongServerGame();