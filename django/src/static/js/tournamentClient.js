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
        
        // Add button event listeners
        const createTournamentBtn = document.getElementById('createTournamentBtn');
        const inviteFriendsBtn = document.getElementById('inviteFriendsBtn');
        
        if (inviteFriendsBtn) {
            inviteFriendsBtn.addEventListener('click', () => {
                this.showInviteFriendsDialog();
            });
        }
        
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

    showInviteFriendsDialog() {
        // Check if there's an existing dialog element
        let dialog = document.getElementById('friendsInviteDialog');
        
        // If not, create one
        if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = 'friendsInviteDialog';
            dialog.className = 'friends-invite-dialog';
            
            // Add content to the dialog
            dialog.innerHTML = `
                <h3 style="margin-bottom: 15px; font-size: 18px; font-weight: bold;">Invite Friends to Tournament</h3>
                <p style="margin-bottom: 10px;">Select friends to invite:</p>
                <div id="friendsList" style="max-height: 300px; overflow-y: auto;">
                    <p>Loading friends list...</p>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button id="cancelInviteBtn" style="margin-right: 10px; padding: 8px 12px; border: 1px solid #ccc; background: #f0f0f0; border-radius: 4px;">Cancel</button>
                    <button id="sendInvitesBtn" style="padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 4px;">Send Invites</button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // Add event listeners for the dialog buttons
            document.getElementById('cancelInviteBtn').addEventListener('click', () => {
                dialog.remove();
            });
            
            document.getElementById('sendInvitesBtn').addEventListener('click', () => {
                this.sendTournamentInvites();
                dialog.remove();
            });
            
            // Fetch connected friends list
            this.fetchConnectedFriends();
        }
    }

    fetchConnectedFriends() {
        const friendsList = document.getElementById('friendsList');
    
        // Show loading indicator
        friendsList.innerHTML = '<p>Loading friends list...</p>';
    
        // Fetch connected friends from your API
        fetch('/api/online-friends/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include' // Important: include cookies for authentication
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Friends data received:', data);
            // Use the online_friends array from the response
            this.displayFriendsList(data.online_friends || []);
        })
        .catch(error => {
            console.error('Error fetching friends:', error);
            friendsList.innerHTML = '<p>Error loading friends. Please try again.</p>';
        });
    }

    // Add new method to display friends list
    displayFriendsList(friendsData) {
        const friendsList = document.getElementById('friendsList');

        // Clear loading message
        friendsList.innerHTML = '';

        // Check if we have friends
        if (!friendsData || friendsData.length === 0) {
            friendsList.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>No online friends found.</p>
                    <p style="margin-top: 10px; font-size: 14px; color: #666;">
                        Your friends need to be online to receive invitations.
                    </p>
                </div>`;
            return;
        }

        // Create a container for the friends list
        const listContainer = document.createElement('div');
        listContainer.className = 'friends-list-container';

        // Add each friend to the list
        friendsData.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.style.display = 'flex';
            friendItem.style.alignItems = 'center';
            friendItem.style.padding = '10px';
            friendItem.style.borderBottom = '1px solid #eee';

            // Friend profile picture
            let profilePicHtml = '';
            if (friend.profile_picture) {
                profilePicHtml = `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">`;
            } else {
                profilePicHtml = `<div class="profile-picture bg-gray-300" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #ccc;"><span>${friend.username.charAt(0).toUpperCase()}</span></div>`;
            }

            // Create the inner HTML for the friend item
            friendItem.innerHTML = `
                <div style="flex: 0 0 40px; margin-right: 10px;">${profilePicHtml}</div>
                <div style="flex: 1;">${friend.username}</div>
                <div style="flex: 0 0 60px;">
                    <button class="invite-btn" data-username="${friend.username}" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Invite</button>
                </div>
            `;

            listContainer.appendChild(friendItem);
        });

        friendsList.appendChild(listContainer);

        // Add event listeners for invite buttons
        const inviteButtons = friendsList.querySelectorAll('.invite-btn');
        inviteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                this.inviteFriend(username);
                e.target.disabled = true;
                e.target.textContent = 'Invited';
                e.target.style.backgroundColor = '#888';
            });
        });
    }

    // Add method to handle inviting an individual friend
    inviteFriend(username) {
        console.log(`Inviting friend: ${username}`);

        // Send invitation to friend via WebSocket
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'invite_friend',
                friend_username: username
            }));
        } else {
            // Connect WebSocket if not connected yet
            this.connectWebSocket();
            setTimeout(() => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        type: 'invite_friend',
                        friend_username: username
                    }));
                } else {
                    console.error('Could not establish WebSocket connection');
                    alert(`Could not send invite to ${username}. Please try again.`);
                }
            }, 1000);
        }
    }

    // Update the existing sendTournamentInvites method
    sendTournamentInvites() {
        // Close dialog after sending invites
        console.log('All invites sent. Ready to start tournament!');

        // Optionally, you could automatically create the tournament after sending invites
        const createTournamentBtn = document.getElementById('createTournamentBtn');
        if (createTournamentBtn) {
            // createTournamentBtn.click();  // Uncomment if you want to auto-start the tournament
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
        // Get token from cookie
        const token = document.cookie
            .split('; ')
            .find(cookie => cookie.startsWith('access_token='))
            ?.split('=')[1];
            
        console.log("Token found:", token ? "Yes" : "No");
            
        // Include token in URL as query parameter
        this.socket = new WebSocket(`ws://${window.location.host}/ws/tournament/?token=${token}`);
        
        this.socket.onopen = () => {
            console.log('Tournament WebSocket connection established.');
            // Send create_tournament message ONCE
            this.socket.send(JSON.stringify({
                type: 'create_tournament'
            }));
            console.log('Sent create_tournament message');
        };
    
        this.socket.onmessage = (event) => {
            console.log('Received message:', event.data);
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error("Error parsing message:", e);
            }
        };
    
        this.socket.onclose = (event) => {
            console.log('Tournament WebSocket connection closed.', event.code, event.reason);
            this.stopGame();
            
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

    handleMessage(data) {
        console.log('Processing data:', data.type);
        if (data.type === 'tournament_rankings') {
            console.log('Tournament rankings received:', data);
            
            // If tournament is complete, update UI accordingly
            if (data.complete) {
                this.isInMatch = false;  // Ensure we're not in match mode
                this.matchId = null;     // Clear match ID
            }
            
            // Display rankings (this should work regardless of if we're in a match)
            this.clearCanvas();
            this.displayTournamentRankings(data);
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
        
        // Always process tournament rankings even if they arrive while in other states
        if (data.type === 'tournament_rankings') {
            console.log('Received tournament rankings:', data);
            this.displayTournamentRankings(data);
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
        } else if (data.type === 'match_result') {
            this.displayMatchResult(data);
        } else if (data.type === 'finals_starting') {
            this.displayFinalsAnnouncement(data);
        } else if (data.type === 'third_place_starting') {
            this.displayThirdPlaceAnnouncement(data);
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
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Tournament Lobby', this.canvas.width / 2, 50);
        
        // Draw "Waiting for players" message
        this.ctx.font = '24px Arial';
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
        
        // Check if this is the final match or third-place match
        const isFinalMatch = data.match_id === 'final' || data.match_id === 'third_place';
        
        // Draw different text based on match type
        this.ctx.font = '20px Arial';
        if (isFinalMatch) {
            this.ctx.fillText("Le classement final sera bientôt affiché...", 
                        this.canvas.width / 2, this.canvas.height / 2 + 50);
        } else {
            this.ctx.fillText("Attendez la prochaine phase du tournoi...", 
                        this.canvas.width / 2, this.canvas.height / 2 + 50);
        }
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