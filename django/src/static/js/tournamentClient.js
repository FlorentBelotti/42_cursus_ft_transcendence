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
        this.init();
    }

    init() {
        console.log('Initializing Tournament Client');
        this.connectWebSocket();
        this.addEventListeners();
    }

    connectWebSocket() {
        const token = document.cookie
            .split('; ')
            .find(cookie => cookie.startsWith('access_token='))
            ?.split('=')[1];
            
        this.socket = new WebSocket(`ws://localhost:8000/ws/tournament/?token=${token}`);
        
        this.socket.onopen = () => {
            console.log('Tournament WebSocket connection established.');
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

    handleMessage(data) {
        console.log('Received tournament state:', data);
        
        // Don't interrupt an ongoing match with other messages
        if (this.isInMatch) {
            // Only process match-related messages for THIS specific match
            if (data.type === 'match_update' && 
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
        
        // Draw center waiting message
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw player cards in the corners
        this.players.forEach(player => {
            const position = this.playerPositions[player.position - 1];
            this.drawPlayerCard(player, position.x, position.y);
        });
        
        // Draw empty slots
        for (let i = this.players.length; i < 4; i++) {
            const position = this.playerPositions[i];
            this.drawEmptySlot(position.x, position.y);
        }
    }

    drawPlayerCard(player, x, y) {
        // Draw card background
        this.ctx.fillStyle = '#4CAF50';  // Green background
        this.ctx.fillRect(x - 100, y - 50, 200, 100);
        
        // Draw player info
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.username, x, y - 15);
        this.ctx.fillText(`ELO: ${player.elo}`, x, y + 15);
    }

    drawEmptySlot(x, y) {
        // Draw empty slot background
        this.ctx.fillStyle = '#ddd';  // Light gray
        this.ctx.fillRect(x - 100, y - 50, 200, 100);
        
        // Draw waiting text
        this.ctx.fillStyle = '#666';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('En attente...', x, y);
    }

    displayThirdPlaceAnnouncement(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2 - 30);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`${data.contestants.player1} vs ${data.contestants.player2}`, 
                        this.canvas.width / 2, this.canvas.height / 2 + 10);
    }
    
    displayThirdPlaceResult(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillText("En attente de la finale...", 
                        this.canvas.width / 2, this.canvas.height / 2 + 40);
    }

    displayMessage(message) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    renderGame(gameState) {
        if (!gameState || !this.isInMatch) return;
    
        this.clearCanvas();
        
        // Clear the canvas with gray background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw pads (both black like in pongServer)
        this.ctx.fillStyle = 'black';  // Both pads black
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
        
        // Draw ball as rectangle instead of circle
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
        
        // Draw player info in the same format as pongServer
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `${gameState.player_info.player1.username} (${gameState.player_info.player1.elo})`, 
            10, 
            25
        );
    
        this.ctx.textAlign = 'right';
        this.ctx.fillText(
            `${gameState.player_info.player2.username} (${gameState.player_info.player2.elo})`, 
            this.canvas.width - 10, 
            25
        );
    }

    displayMatchResult(data) {
        this.clearCanvas();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
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
        
        // Draw player 1 info (left)
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(data.finalists.player1, this.canvas.width / 2 - 30, this.canvas.height / 2);
        
        // Draw player 2 info (right)
        this.ctx.textAlign = 'left';
        this.ctx.fillText(data.finalists.player2, this.canvas.width / 2 + 30, this.canvas.height / 2);
        
        // Draw preparing message
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Arial';
        this.ctx.fillText("Préparation de la finale...", 
                        this.canvas.width / 2, this.canvas.height / 2 + 50);
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
            
            if (rank.position <= 3) {
                // Draw name on podium
                this.ctx.fillText(
                    `${rank.medal} ${rank.username}`, 
                    pos.x, 
                    pos.y - height + 70
                );
            } else {
                // Draw 4th place below podiums
                this.ctx.fillText(
                    `4ème place: ${rank.username}`,
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

    displayTournamentResult(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw trophy
        this.ctx.fillStyle = 'gold';
        this.drawTrophy(this.canvas.width / 2, 150, 80);
        
        // Draw champion message
        this.ctx.fillStyle = 'black';
        this.ctx.font = '36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw champion name
        this.ctx.font = '30px Arial';
        this.ctx.fillText(data.champion, this.canvas.width / 2, this.canvas.height / 2 + 50);
        
        // Draw runner-up info
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Finaliste: ${data.runner_up}`, 
                        this.canvas.width / 2, this.canvas.height / 2 + 100);
        
        // Draw tournament end message
        this.ctx.font = '18px Arial';
        this.ctx.fillText("Tournoi terminé! Les ELO ont été mis à jour.", 
                        this.canvas.width / 2, this.canvas.height / 2 + 150);
    }
    
    drawTrophy(x, y, size) {
        const cup_width = size * 0.6;
        const stem_width = size * 0.2;
        const base_width = size * 0.8;
        
        // Cup
        this.ctx.beginPath();
        this.ctx.moveTo(x - cup_width/2, y);
        this.ctx.lineTo(x + cup_width/2, y);
        this.ctx.quadraticCurveTo(x + cup_width/2 + size*0.2, y + size*0.4, x + cup_width/2, y + size*0.5);
        this.ctx.lineTo(x - cup_width/2, y + size*0.5);
        this.ctx.quadraticCurveTo(x - cup_width/2 - size*0.2, y + size*0.4, x - cup_width/2, y);
        this.ctx.fill();
        
        // Stem
        this.ctx.fillRect(x - stem_width/2, y + size*0.5, stem_width, size*0.3);
        
        // Base
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + size*0.8, base_width/2, size*0.1, 0, 0, Math.PI * 2);
        this.ctx.fill();
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
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tournament = new TournamentClient();
});