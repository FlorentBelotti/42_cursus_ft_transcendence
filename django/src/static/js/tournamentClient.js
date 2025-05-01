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
        this.isTournamentCancelled = false; // Add this flag
        this.cancelledMatchIds = []; // Add this array
        this.isShowingMatchResult = false;
        this.finalMatchCompleted = false;
        this.rankingsCheckInterval = null;
        this.rankingsCheckCount = 0;
        this.isPageUnloading = false; // Nouvelle propriété pour suivre l'état de déchargement de la page
        this.init();
    }


    init() {
        console.log('Initializing Tournament Client');
        // Display welcome message on canvas
        this.displayWelcomeScreen();
        this.addEventListeners();

        // Add button event listeners
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
        this.ctx.fillStyle = '#181818';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '32px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Pong Tournament', this.canvas.width / 2, 150);

        this.ctx.font = '20px Noto';
        this.ctx.fillText('Click "Create Tournament" to begin', this.canvas.width / 2, 220);

        this.ctx.font = '16px Noto';
        this.ctx.fillText('You will be matched with other players', this.canvas.width / 2, 270);
        this.ctx.fillText('for a 4-player tournament', this.canvas.width / 2, 300);

        // Display user info
        if (typeof currentUser !== 'undefined') {
            const displayName = currentUser.nickname || currentUser.username;
            this.ctx.fillText(`Player: ${displayName} (ELO: ${currentUser.elo})`, this.canvas.width / 2, 350);
        }
    }

    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new WebSocket(`${wsProtocol}${window.location.host}/ws/tournament/`);

        this.socket.onopen = () => {
            console.log('Tournament WebSocket connection established.');
            this.socket.send(JSON.stringify({
                type: 'create_tournament'
            }));
            console.log('Sent create_tournament message');
        };

        this.socket.onmessage = (event) => {
            console.log('Tournament WebSocket message received:', event.data);
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed message type:', data.type);

                if (this.isTournamentCancelled && data.type === 'game_update') {
                    console.log('Skipping game update for cancelled tournament');
                    return;
                }

                this.handleMessage(data);
            } catch (e) {
                console.error("Error parsing message:", e);
            }
        };

        this.socket.onclose = (event) => {
            console.log('Tournament WebSocket connection closed.', event.code, event.reason);
            this.stopGame();
            if (!this.isPageUnloading) {
                // Set a timeout to reconnect
                setTimeout(() => this.connectWebSocket(), 2000);
            }
            // Re-enable the button if connection is lost
            const createTournamentBtn = document.getElementById('createTournamentBtn');
            if (createTournamentBtn) {
                createTournamentBtn.disabled = false;
                createTournamentBtn.textContent = 'Create Tournament';
            }
        };

        this.socket.onerror = (error) => {
            console.error('Tournament WebSocket error:', error);
        };
    }

    resetTournamentState() {
        this.isInMatch = false;
        this.matchId = null;
        this.gameState = null;
        this.playerNumber = null;
        this.isTournamentCancelled = false;
        this.cancelledMatchIds = [];
    }

    handleMessage(data) {
        console.log('Processing data:', data.type);

        if (data.type === 'tournament_cancelled') {
            console.log('Tournament cancelled:', data);

            // Force exit from any match mode and reset all game state
            this.isInMatch = false;
            this.matchId = null;
            this.gameState = null;
            this.playerNumber = null;

            // Set a flag to ignore future game state updates
            this.isTournamentCancelled = true;

            // Store active match IDs to explicitly ignore
            this.cancelledMatchIds = data.active_match_ids || [];

            // Display cancellation screen
            this.displayTournamentCancelled(data);

            return; // Exit early
        }

        if (this.isTournamentCancelled) {
            console.log('Ignoring message for cancelled tournament:', data.type);
            return;
        }

        if (data.type === 'game_update' && data.game_state && data.game_state.match_id) {
            if (this.cancelledMatchIds &&
                this.cancelledMatchIds.includes(data.game_state.match_id)) {
                console.log('Ignoring update for cancelled match:', data.game_state.match_id);
                return;
            }
        }

        // Tournament rankings message handling
        if (data.type === 'tournament_rankings') {
            console.log('Received tournament rankings:', data.complete ? 'FINAL' : 'PARTIAL');

            // Store rankings regardless
            this.pendingRankings = data;

            // Special case: If this player just completed a final match, always show complete rankings
            if (data.complete && this.finalMatchCompleted) {
                console.log('Final player receiving complete rankings - displaying immediately');

                // Clear any existing interval check
                if (this.rankingsCheckInterval) {
                    clearInterval(this.rankingsCheckInterval);
                }

                // Small delay to ensure the match result is seen
                setTimeout(() => {
                    this.isShowingMatchResult = false;
                    this.clearCanvas();
                    this.displayTournamentRankings(data);
                }, 1500);
                return;
            }

            // Normal display logic for other cases
            if (!this.isInMatch && !this.isShowingMatchResult && this.matchId === null) {
                console.log('Player not in match - displaying rankings immediately');
                if (data.complete || (data.rankings && data.rankings.length > 0)) {
                    this.clearCanvas();
                    this.displayTournamentRankings(data);
                }
            } else {
                console.log('Player in active match or showing result - storing rankings for later');
            }
            return;
        }
        // Match handling - check specifically for match_result
        if (data.type === 'match_result' && data.match_id === this.matchId) {
            console.log('Match ended:', data.match_id);

            // Immediately reset match state to prevent game freeze
            this.isInMatch = false;
            this.matchId = null;

            // Then display result
            this.clearCanvas();
            this.displayMatchResult(data);
            return; // Exit early to prevent other processing
        }

        if (this.isInMatch) {
            if (data.type === 'game_update' &&
                this.gameState &&
                data.game_state &&
                data.game_state.match_id === this.matchId) {

                this.gameState = data.game_state;
                this.renderGame(this.gameState);
            }
            return;
        }

        // Normal message handling when not in a match
        this.clearCanvas();

        if (data.type === 'tournament_state') {
            console.log('Rendering tournament lobby with', data.players.length, 'players');
            this.players = data.players;
            this.renderLobby(data);

            // Update tournament info div
            const infoDiv = document.getElementById('tournamentInfo');
            if (infoDiv) {
                infoDiv.innerHTML = `<p>${data.message}</p>`;
                if (data.waiting) {
                    infoDiv.innerHTML += `<p>Your position: ${data.your_position}</p>`;
                }
            }
        } else if (data.type === 'tournament_starting') {
            this.displayMessage(data.message);
        } else if (data.type === 'match_created') {
            this.isInMatch = true;
            this.matchId = data.match_id;
            this.playerNumber = data.player_number;
            this.opponent = data.opponent;
            this.gameState = data.game_state;
            const infoDiv = document.getElementById('tournamentInfo');
            if (infoDiv) {
                infoDiv.innerHTML = '';
            }
            this.renderGame(this.gameState);
        } else if (data.type === 'finals_starting') {
            this.displayFinalsAnnouncement(data);
        } else if (data.type === 'third_place_starting') {
            this.displayThirdPlaceAnnouncement(data);
        }
    }

    displayTournamentCancelled(data) {
        console.log("⚠️ Displaying tournament cancellation screen", data);

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        try {
            this.clearCanvas();

            // Draw red warning banner
            this.ctx.fillStyle = '#ffcccc';
            this.ctx.fillRect(0, 100, this.canvas.width, 80);

            // Draw title
            this.ctx.fillStyle = '#cc0000';
            this.ctx.font = '32px Noto';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Tournament Cancelled', this.canvas.width / 2, 150);

            // Draw cancellation reason
            this.ctx.fillStyle = 'white';
            this.ctx.font = '22px Noto';

            // If we have forfeiter info, display it
            const displayName = data.forfeiter_display || data.forfeiter || "A player";
            this.ctx.fillText(`${displayName} left the tournament`,
                             this.canvas.width / 2, 220);

            // Draw penalty message
            this.ctx.font = '18px Noto';
            this.ctx.fillText("The player who left received an ELO penalty (-15)",
                             this.canvas.width / 2, 280);

            // Draw divider
            this.ctx.strokeStyle = '#dddddd';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(200, 320);
            this.ctx.lineTo(600, 320);
            this.ctx.stroke();

            // Draw try again message
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.font = '24px Noto';
            // this.ctx.fillText("You can join a new tournament",
            //                  this.canvas.width / 2, 380);

            console.log("✅ Cancellation screen drawn successfully");
        } catch (err) {
            console.error("❌ Error displaying cancellation screen:", err);
        }

        // Always update UI elements outside of try/catch
        // Re-enable the create tournament button
        // const createTournamentBtn = document.getElementById('createTournamentBtn');
        // if (createTournamentBtn) {
        //     createTournamentBtn.disabled = false;
        //     createTournamentBtn.textContent = 'Create Tournament';
        // }

        // Information div update
        const infoDiv = document.getElementById('tournamentInfo');
        if (infoDiv) {
            infoDiv.innerHTML = '<p class="error">Tournament cancelled due to player forfeit</p>';
        }
    }

    // Add a helper method to ensure canvas is fully cleared
    clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            console.error('Cannot clear canvas - context or canvas missing');
        }
    }

    renderLobby(data) {
        console.log('Rendering lobby...');

        // Make sure canvas exists
        if (!this.canvas) {
            console.error('Canvas not found!');
            this.canvas = document.getElementById('tournamentCanvas');
            if (!this.canvas) {
                console.error('Still can\'t find canvas!');
                return;
            }
        }

        // Make sure context exists
        if (!this.ctx) {
            console.error('Canvas context not found!');
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                console.error('Failed to get canvas context!');
                return;
            }
        }

        this.clearCanvas();

        // Draw title
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Tournament Lobby', this.canvas.width / 2, 50);

        // Draw "Waiting for players" message
        this.ctx.font = '24px Noto';
        this.ctx.fillText(data.message, this.canvas.width / 2, 90);

        // Draw bracket structure
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;

        // Draw player positions or empty slots
        for (let i = 0; i < 4; i++) {
            const player = data.players.find(p => p.position === i + 1) || null;
            const position = this.playerPositions[i];

            if (player) {
                this.drawPlayerCard(player, position.x, position.y);
            } else {
                this.drawEmptySlot(position.x, position.y);
            }
        }

        console.log('Lobby rendering complete');
    }

    drawPlayerCard(player, x, y) {
        // Draw player background
        this.ctx.fillStyle = '#171717';
        this.ctx.fillRect(x - 75, y - 45, 150, 90);

        // Draw player name and ELO
        this.ctx.fillStyle = 'white';
        this.ctx.font = '18px Noto';
        this.ctx.textAlign = 'center';

        // Use nickname if available, otherwise username
        const displayName = player.nickname || player.username;
        this.ctx.fillText(displayName, x, y - 10);

        this.ctx.font = '16px Noto';
        this.ctx.fillText(`ELO: ${player.elo}`, x, y + 20);
    }

    drawEmptySlot(x, y) {
        // Draw empty slot background
        this.ctx.fillStyle = '#171717';
        this.ctx.strokeStyle = '#171717';
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(x - 75, y - 45, 150, 90);
        this.ctx.strokeRect(x - 75, y - 45, 150, 90);

        // Draw waiting text
        this.ctx.fillStyle = '#808080';
        this.ctx.font = '18px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Waiting...', x, y);
    }

    displayFinalsAnnouncement(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw finals announcement
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2 - 50);

        // Draw VS text
        this.ctx.font = '40px Noto';
        this.ctx.fillText('VS', this.canvas.width / 2, this.canvas.height / 2);

        // Draw player 1 info (left) - Use display name if available
        this.ctx.font = '24px Noto';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(data.finalists.player1_display || data.finalists.player1, this.canvas.width / 2 - 30, this.canvas.height / 2);

        // Draw player 2 info (right) - Use display name if available
        this.ctx.textAlign = 'left';
        this.ctx.fillText(data.finalists.player2_display || data.finalists.player2, this.canvas.width / 2 + 30, this.canvas.height / 2);

        // Draw preparing message
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Noto';
        this.ctx.fillText("Préparation de la finale...",
                    this.canvas.width / 2, this.canvas.height / 2 + 50);
    }

    displayThirdPlaceAnnouncement(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw third-place announcement
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2 - 50);

        // Draw VS text
        this.ctx.font = '40px Noto';
        this.ctx.fillText('VS', this.canvas.width / 2, this.canvas.height / 2);

        // Draw player 1 info (left)
        this.ctx.font = '24px Noto';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(data.contestants.player1_display || data.contestants.player1, this.canvas.width / 2 - 30, this.canvas.height / 2);

        // Draw player 2 info (right)
        this.ctx.textAlign = 'left';
        this.ctx.fillText(data.contestants.player2_display || data.contestants.player2, this.canvas.width / 2 + 30, this.canvas.height / 2);

        // Draw preparing message
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Noto';
        this.ctx.fillText("Préparation du match pour la 3ème place...",
                    this.canvas.width / 2, this.canvas.height / 2 + 50);
    }

    displayMatchResult(data) {
        this.clearCanvas();

        // Set a flag to indicate we're in transition, still showing match result
        this.isShowingMatchResult = true;

        // Force reset game state to ensure clean exit from game
        this.gameState = null;

        // Draw result message
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);

        // Check if this is the final match or third-place match
        const isFinalMatch = data.match_id === 'final' || data.match_id === 'third_place';

        // Draw different text based on match type
        this.ctx.font = '20px Noto';
        if (isFinalMatch) {
            this.ctx.fillText("Le classement final sera bientôt affiché...",
                        this.canvas.width / 2, this.canvas.height / 2 + 50);

            // For final/third-place matches, set a longer timeout to ensure we see final rankings
            setTimeout(() => {
                console.log('Final match result screen timeout complete - checking for rankings');
                this.isShowingMatchResult = false;

                // If there are pending final rankings, show them
                if (this.pendingRankings && this.pendingRankings.complete) {
                    console.log('Found pending final rankings, displaying now');
                    this.clearCanvas();
                    this.displayTournamentRankings(this.pendingRankings);
                    this.pendingRankings = null;
                }
            }, 5000);  // 5 seconds for finals
        } else {
            this.ctx.fillText("Attendez la prochaine phase du tournoi...",
                        this.canvas.width / 2, this.canvas.height / 2 + 50);

            // For regular matches, use shorter timeout
            setTimeout(() => {
                this.isShowingMatchResult = false;
            }, 3000);
        }
    }

    displayMessage(message) {
        this.clearCanvas();

        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    renderGame(gameState) {
        if (!gameState || !this.isInMatch) return;

        this.clearCanvas();

        // Draw pads
        this.ctx.fillStyle = '#333333';
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
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.fillRect(
            gameState.ball.x,
            gameState.ball.y,
            15, 15
        );
        this.ctx.fill();

        // Draw scores
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gameState.score.player1, this.canvas.width / 2 - 30, 30);
        this.ctx.fillText(":", this.canvas.width / 2, 30);
        this.ctx.fillText(gameState.score.player2, this.canvas.width / 2 + 30, 30);

        // Draw player info with nickname support
        const player1 = gameState.player_info?.player1 || {};
        const player2 = gameState.player_info?.player2 || {};

        const player1Display = player1.nickname || player1.username;
        const player2Display = player2.nickname || player2.username;

        this.ctx.font = '20px Noto';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `${player1Display} (${player1.elo})`,
            20,
            20
        );

        this.ctx.textAlign = 'right';
        this.ctx.fillText(
            `${player2Display} (${player2.elo})`,
            this.canvas.width - 20,
            20
        );
    }

    displayTournamentRankings(data) {
        this.clearCanvas();

        // Draw podium background
        this.ctx.fillStyle = '#181818';
        this.ctx.fillRect(100, 200, 600, 250);

        // Draw title
        this.ctx.fillStyle = 'white';
        this.ctx.font = '36px Noto';
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
            this.ctx.font = '40px Noto';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(i, pos.x, pos.y - height + 40);
        }

        // Draw player names on podiums
        for (const rank of data.rankings) {
            const pos = podiumPositions[rank.position];
            const height = podiumHeights[rank.position];

            this.ctx.fillStyle = 'black';
            this.ctx.font = '20px Noto';
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
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Noto';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                "Matches en cours... Classement partiel",
                this.canvas.width / 2,
                500
            );
        } else {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Noto';
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
        
        // Fermeture propre du WebSocket si nous quittons la page
        if (this.isPageUnloading && this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                // Éviter la reconnexion automatique
                this.socket.onclose = null;
                // Fermer la connexion
                this.socket.close(1000, "Navigation away from page");
                this.socket = null;
            }
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

    declareForfeit() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        const isTournamentComplete = document.querySelector('#tournamentInfo')?.innerText.includes('Classement final');

        console.log("Declaring tournament forfeit before navigation, tournament complete:", isTournamentComplete);

        try {
            if (!isTournamentComplete) {
                this.socket.send(JSON.stringify({
                    type: 'leave_tournament'
                }));
            } else {
                console.log("Tournament already complete, no need to declare forfeit");
            }

            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            }
            return true;
        } catch (e) {
            console.error("Error in declareForfeit:", e);
            return false;
        }
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

// Add this to the bottom of /home/fbelotti/Documents/Workspace/42_cursus_ft_transcendence/django/src/static/js/tournamentClient.js
window.declarePongTournamentForfeit = function() {
    console.log("Global tournament forfeit declaration triggered");

    try {
        // Case 1: Use the existing tournament client if available
        if (window.tournament && window.tournament.socket) {
            console.log("Found active tournament client, sending forfeit via WebSocket");

            // Marquer que la page est en déchargement pour éviter les reconnexions automatiques
            window.tournament.isPageUnloading = true;

            if (window.tournament.socket.readyState === WebSocket.OPEN) {
                // Send forfeit message
                window.tournament.socket.send(JSON.stringify({
                    type: 'leave_tournament'
                }));

                // Force close the socket
                window.tournament.socket.onclose = null; // Remove reconnect handler
                window.tournament.socket.close(1000, "User navigated away");
                console.log("Socket forcibly closed for tournament forfeit");
                
                return true;
            }
        }
        // Case 2: Direct API call as fallback when no tournament client exists
        else {
            console.log("No active tournament client, using API fallback");

            // Make a synchronous API call to forfeit
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/tournament/forfeit/', false); // false = synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');

            // Get CSRF token from cookie if available
            const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");

            if (csrfToken) {
                xhr.setRequestHeader('X-CSRFToken', csrfToken);
            }

            // Send the forfeit request
            try {
                xhr.send();
                console.log("Tournament forfeit API response:", xhr.status);
                return true;
            } catch (e) {
                console.error("Tournament forfeit API call failed:", e);
            }
        }

        return false;
    } catch (error) {
        console.error("Error in global tournament forfeit declaration:", error);
        return false;
    }
};

// document.addEventListener('DOMContentLoaded', () => {
//     const tournament = new TournamentClient();
// });

window.initPongTournament = function() {
    // Only create the instance if it doesn't already exist
    if (!window.tournament) {
        console.log('Creating pongServerGame instance from initPongServerGame');
        window.tournament = new TournamentClient();
    } else {
        console.log('pongServerGame instance already exists, skipping creation');
    }
};
