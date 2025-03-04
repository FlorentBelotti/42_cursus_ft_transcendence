class TournamentClient {
    constructor() {
        this.canvas = document.getElementById('tournamentCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = null;
        this.playerPositions = [
            { x: 150, y: 150 },  // Position 1 (top-left)
            { x: 650, y: 150 },  // Position 2 (top-right)
            { x: 150, y: 400 },  // Position 3 (bottom-left)
            { x: 650, y: 400 }   // Position 4 (bottom-right)
        ];
        this.players = [];
        this.isInMatch = false;
        this.gameState = null;
        this.playerNumber = null;
        this.matchId = null;
        this.keysPressed = {};
        this.animationFrameId = null;
        this.authenticated = false;
        this.init();
    }

    init() {
        console.log('Initializing Tournament Client');
        // Display welcome message on canvas
        this.displayWelcomeScreen();
        this.addEventListeners();
        
        // Add button event listener
        const createTournamentBtn = document.getElementById('createTournamentBtn');
        if (createTournamentBtn) {
            createTournamentBtn.addEventListener('click', () => {
                // Disable the button to prevent multiple clicks
                createTournamentBtn.disabled = true;
                createTournamentBtn.textContent = 'Joining Tournament...';
                
                // Now connect to WebSocket and join tournament
                this.connectWebSocket();
            });
        }
    }
    
    displayWelcomeScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#333';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Pong Tournament', this.canvas.width / 2, 150);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Click "Create Tournament" to begin', this.canvas.width / 2, 220);
        
        this.ctx.font = '16px Arial';
        this.ctx.fillText('You will be matched with other players', this.canvas.width / 2, 270);
        this.ctx.fillText('for a 4-player tournament', this.canvas.width / 2, 300);
        
        // Display user info
        if (typeof currentUser !== 'undefined') {
            const displayName = currentUser.nickname || currentUser.username;
            this.ctx.fillText(`Player: ${displayName} (ELO: ${currentUser.elo})`, this.canvas.width / 2, 350);
        }
    }

    connectWebSocket() {
        this.socket = new WebSocket(`ws://${window.location.host}/ws/tournament/`);
        
        this.socket.onopen = () => {
            console.log('Tournament WebSocket connection established.');
            // Authenticate first
            const token = this.getCookie('access_token');
            if (token) {
                this.socket.send(JSON.stringify({
                    type: 'authenticate',
                    token: token
                }));
            } else {
                console.error('No access token found');
                this.displayMessage('Authentication failed: No token found');
            }
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('Tournament WebSocket connection closed.');
            this.stopGame();
        };

        this.socket.onerror = (error) => {
            console.error('Tournament WebSocket error:', error);
        };
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    handleMessage(data) {
        console.log('Received data:', data);
        
        // Handle authentication response first
        if (data.type === 'authenticated') {
            console.log('Successfully authenticated');
            this.authenticated = true;
            
            // Now create/join tournament
            this.socket.send(JSON.stringify({
                type: 'create_tournament'
            }));
            return;
        } else if (data.type === 'error') {
            console.error('Error:', data.message);
            this.displayMessage(`Error: ${data.message}`);
            return;
        }
        
        // Don't process game messages until authenticated
        if (!this.authenticated) {
            return;
        }
        
        // Don't interrupt an ongoing match with other messages
        if (this.isInMatch) {
            // Only process match-related messages for THIS specific match
            if (data.type === 'game_update' && 
                this.gameState && 
                data.game_state && 
                data.game_state.match_id === this.matchId) {
                
                this.gameState = data.game_state;
                this.renderGame(this.gameState);
            }
            else if (data.type === 'match_result' && data.match_id === this.matchId) {
                // Only handle match result if it's for our current match
                this.isInMatch = false;  // End match mode
                this.matchId = null;     // Clear match ID
                this.clearCanvas();      // Completely clear the canvas
                this.displayMatchResult(data);
            }
            // Strictly ignore ALL other messages while in a match
            return;
        }
        
        // Normal message handling when not in a match (ALWAYS clear canvas first)
        this.clearCanvas();
        
        if (data.type === 'tournament_state') {
            this.players = data.players;
            this.renderLobby(data);
        } else if (data.type === 'tournament_starting') {
            this.displayMessage(data.message);
        } else if (data.type === 'match_created') {
            this.isInMatch = true;
            this.matchId = data.match_id;
            this.playerNumber = data.player_number;
            this.opponent = data.opponent;
            this.gameState = data.game_state;
            this.renderGame(this.gameState);
        } else if (data.type === 'match_result') {
            this.displayMatchResult(data);
        } else if (data.type === 'finals_starting') {
            this.displayFinalsAnnouncement(data);
        } else if (data.type === 'third_place_starting') {
            this.displayThirdPlaceAnnouncement(data);
        } else if (data.type === 'tournament_rankings') {
            this.displayTournamentRankings(data);
        }
    }
    
    // Add a helper method to ensure canvas is fully cleared
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderLobby(data) {
        this.clearCanvas();
        
        // Draw title
        this.ctx.fillStyle = 'black';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Tournament Lobby', this.canvas.width / 2, 60);
        
        // Draw message
        this.ctx.font = '24px Arial';
        this.ctx.fillText(data.message, this.canvas.width / 2, 100);
        
        // Draw player slots
        for (let i = 0; i < 4; i++) {
            const pos = this.playerPositions[i];
            
            if (i < data.players.length) {
                // Draw player
                this.drawPlayerCard(data.players[i], pos.x, pos.y);
            } else {
                // Draw empty slot
                this.drawEmptySlot(pos.x, pos.y);
            }
        }
        
        // Highlight your position
        if (data.your_position) {
            const pos = this.playerPositions[data.your_position - 1];
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(pos.x - 75, pos.y - 45, 150, 90);
        }
    }

    drawPlayerCard(player, x, y) {
        // Draw player background
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.fillRect(x - 75, y - 45, 150, 90);
        
        // Draw player name and ELO
        this.ctx.fillStyle = 'black';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        
        // Use nickname if available, otherwise username
        const displayName = player.nickname || player.username;
        this.ctx.fillText(displayName, x, y - 10);
        
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`ELO: ${player.elo}`, x, y + 20);
    }

    drawEmptySlot(x, y) {
        // Draw empty slot background
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.strokeStyle = '#c0c0c0';
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(x - 75, y - 45, 150, 90);
        this.ctx.strokeRect(x - 75, y - 45, 150, 90);
        
        // Draw waiting text
        this.ctx.fillStyle = '#808080';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Waiting...', x, y);
    }

    displayFinalsAnnouncement(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw finals announcement
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        // Draw VS text
        this.ctx.font = '40px Arial';
        this.ctx.fillText('VS', this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw player 1 info (left) - Use display name if available
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(data.finalists.player1_display || data.finalists.player1, this.canvas.width / 2 - 30, this.canvas.height / 2);
        
        // Draw player 2 info (right) - Use display name if available
        this.ctx.textAlign = 'left';
        this.ctx.fillText(data.finalists.player2_display || data.finalists.player2, this.canvas.width / 2 + 30, this.canvas.height / 2);
        
        // Draw preparing message
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Arial';
        this.ctx.fillText("Préparation de la finale...", 
                    this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
    
    displayThirdPlaceAnnouncement(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw third-place announcement
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        // Draw VS text
        this.ctx.font = '40px Arial';
        this.ctx.fillText('VS', this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw player 1 info (left)
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(data.contestants.player1_display || data.contestants.player1, this.canvas.width / 2 - 30, this.canvas.height / 2);
        
        // Draw player 2 info (right)
        this.ctx.textAlign = 'left';
        this.ctx.fillText(data.contestants.player2_display || data.contestants.player2, this.canvas.width / 2 + 30, this.canvas.height / 2);
        
        // Draw preparing message
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Arial';
        this.ctx.fillText("Préparation du match pour la 3ème place...", 
                    this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
    
    displayMatchResult(data) {
        this.clearCanvas();
        
        // Draw result message
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw next match info
        this.ctx.font = '20px Arial';
        this.ctx.fillText("Attendez la prochaine phase du tournoi...", 
                    this.canvas.width / 2, this.canvas.height / 2 + 50);
    }

    displayMessage(message) {
        this.clearCanvas();
        
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    renderGame(gameState) {
        if (!gameState || !this.isInMatch) return;

        this.clearCanvas();
        
        // Draw pads
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
        this.ctx.beginPath();
        this.ctx.fillRect(
            gameState.ball.x, 
            gameState.ball.y, 
            15, 15
        );
        this.ctx.fill();
        
        // Draw scores
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gameState.score.player1, this.canvas.width / 4, 50);
        this.ctx.fillText(gameState.score.player2, 3 * this.canvas.width / 4, 50);
        
        // Draw player info with nickname support
        const player1 = gameState.player_info?.player1 || {};
        const player2 = gameState.player_info?.player2 || {};
        
        const player1Display = player1.nickname || player1.username;
        const player2Display = player2.nickname || player2.username;
        
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `${player1Display} (${player1.elo})`, 
            10, 
            25
        );

        this.ctx.textAlign = 'right';
        this.ctx.fillText(
            `${player2Display} (${player2.elo})`, 
            this.canvas.width - 10, 
            25
        );
    }
    
    displayTournamentRankings(data) {
        this.clearCanvas();
        
        // Draw podium background
        this.ctx.fillStyle = '#f5f5f5';
        this.ctx.fillRect(100, 200, 600, 250);
        
        // Draw title
        this.ctx.fillStyle = 'black';
        this.ctx.font = '36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Classement du Tournoi', this.canvas.width / 2, 100);
        
        // Draw trophy for complete tournaments
        if (data.complete) {
            this.ctx.fillStyle = 'gold';
            this.drawTrophy(this.canvas.width / 2, 150, 60);
        }
        
        // Draw podium levels
        const podiumHeights = {
            1: 180,  // 1st place (highest)
            2: 140,  // 2nd place
            3: 100,  // 3rd place
            4: 0     // 4th place (no podium)
        };
        
        const podiumPositions = {
            1: {x: this.canvas.width / 2, y: 400},      // Center (gold)
            2: {x: this.canvas.width / 2 - 150, y: 400}, // Left (silver)
            3: {x: this.canvas.width / 2 + 150, y: 400}, // Right (bronze)
            4: {x: this.canvas.width / 2, y: 480}        // Below (no podium)
        };
        
        const podiumColors = {
            1: '#FFD700', // Gold
            2: '#C0C0C0', // Silver
            3: '#CD7F32', // Bronze
            4: '#FFFFFF'  // White (no podium)
        };
        
        // Draw podiums
        for (let i = 1; i <= 3; i++) {
            const pos = podiumPositions[i];
            const height = podiumHeights[i];
            
            // Draw podium block
            this.ctx.fillStyle = podiumColors[i];
            this.ctx.fillRect(pos.x - 60, pos.y - height, 120, height);
            
            // Draw position number
            this.ctx.fillStyle = 'black';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(i, pos.x, pos.y - height + 40);
        }
        
        // Draw player names on podiums
        for (const rank of data.rankings) {
            const pos = podiumPositions[rank.position];
            const height = podiumHeights[rank.position];
            
            this.ctx.fillStyle = 'black';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            
            // Use nickname if available
            const displayName = rank.nickname || rank.username;
            
            if (rank.position <= 3) {
                // Draw name on podium
                this.ctx.fillText(
                    `${rank.medal} ${displayName}`, 
                    pos.x, 
                    pos.y - height + 70
                );
            } else {
                // Draw 4th place below podiums
                this.ctx.fillText(
                    `4ème place: ${displayName}`,
                    pos.x,
                    pos.y
                );
            }
        }
        
        // Draw message for incomplete tournaments
        if (!data.complete) {
            this.ctx.fillStyle = 'black';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                "Matches en cours... Classement partiel",
                this.canvas.width / 2,
                500
            );
        } else {
            this.ctx.fillStyle = 'black';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                "Tournoi terminé! Les ELO ont été mis à jour.",
                this.canvas.width / 2,
                500
            );
        }
    }
    
    drawTrophy(x, y, size) {
        // Simple trophy drawing
        this.ctx.fillRect(x - size/6, y - size/2, size/3, size);
        this.ctx.beginPath();
        this.ctx.arc(x, y - size/2, size/3, 0, Math.PI, false);
        this.ctx.fill();
    }
    
    stopGame() {
        this.isInMatch = false;
        this.matchId = null;
        this.gameState = null;
        this.clearCanvas();
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.isInMatch) return;
            
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.keysPressed[e.key] = true;
                this.sendInput();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!this.isInMatch) return;
            
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.keysPressed[e.key] = false;
                this.sendInput();
            }
        });
    }

    sendInput() {
        if (!this.socket || !this.isInMatch) return;

        let input = 0;
        if (this.keysPressed['ArrowUp']) input = -1;
        if (this.keysPressed['ArrowDown']) input = 1;
        
        this.socket.send(JSON.stringify({
            type: 'player_input',
            input: input
        }));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tournament = new TournamentClient();
});