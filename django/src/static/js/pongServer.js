class PongServerGame {
    constructor() {
        this.canvas = document.getElementById('pongServer');
        if (!this.canvas) {
            console.error("Canvas element not found! Aborting PongServerGame initialization.");
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.matchmakingButton = document.getElementById('matchmaking');
        this.inviteFriendsBtn = document.getElementById('inviteFriendsBtn');
        this.socket = null;
        this.notificationSocket = null;
        this.isGameRunning = false;
        this.isPageUnloading = false;
        this.reconnectTimeout = null;
        this.playerNumber = null;
        this.playerInfo = {
            player1: { username: "", nickname: "", elo: 0 },
            player2: { username: "", nickname: "", elo: 0 }
        };
        this.keysPressed = {};

        // Initialize friend invite manager
        this.friendInviteManager = null;

        // Check URL parameters for pending game invitation
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('game');
        const opponent = urlParams.get('opponent');

        if (gameId && opponent) {
            console.log(`Found invitation parameters in URL: game=${gameId}, opponent=${opponent}`);
            // If we have URL parameters, we'll connect and join immediately
            this.pendingInvitedGame = {
                gameId,
                opponentUsername: opponent,
                isCreator: false
            };
            this.init(true); // Pass true to indicate we're initializing with an invitation
        } else {
            this.init(false);
        }

        // Set up notification socket connection
        this.setupNotificationSocket();
    }

    init(hasInvitation = false) {
        console.log('Initializing PongServerGame' + (hasInvitation ? ' with invitation' : ''));
        window.initUserData();
        if (this.matchmakingButton) {
            console.log('Matchmaking button found');
            this.matchmakingButton.addEventListener('click', () => this.startMatchmaking());
        } else {
            console.error('Matchmaking button not found');
        }

        // Add event listener for invite friends button
        if (this.inviteFriendsBtn) {
            console.log('Invite friends button found');
            this.inviteFriendsBtn.addEventListener('click', () => {
                this.initFriendInviteManager();
                this.friendInviteManager.showDialog();
            });
        } else {
            console.error('Invite friends button not found');
        }

        this.addEventListeners();

        // If we have a pending invitation, connect to WebSocket immediately
        if (hasInvitation && this.pendingInvitedGame) {
            console.log('Connecting to WebSocket for pending invitation');
            this.connectWebSocket(false);
        } else {
            // Otherwise show the welcome screen
            this.displayWelcomeScreen();
        }
    }

    setupNotificationSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.notificationSocket = new WebSocket(`${wsProtocol}${window.location.host}/ws/notifications/`);

        this.notificationSocket.onopen = () => {
            console.log('Notification WebSocket connected');
        };

        this.notificationSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Notification received:', data);

                if (data.type === 'invitation_accepted') {
                    this.handleInvitationAccepted(data);
                }
            } catch (error) {
                console.error('Error processing notification:', error);
            }
        };

        this.notificationSocket.onclose = () => {
            console.log('Notification WebSocket disconnected');
            // Reconnect after delay
            setTimeout(() => this.setupNotificationSocket(), 2000);
        };
    }

    initFriendInviteManager() {
        if (!this.friendInviteManager) {
            this.friendInviteManager = new FriendInviteManager({
                title: 'Inviter des amis à jouer',
                socket: this.socket,
                onInviteSent: (username) => this.handleFriendInvite(username),
                onDialogClosed: () => console.log('Invite dialog closed')
            });
        }
    }

    handleFriendInvite(username) {
        console.log(`Pong Game handling friend invite for: ${username}`);

		// Reset game state if coming from a previous game
		if (this.isGameRunning) {
			this.stopGame();
		}
        // Connect to WebSocket if not already connected
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('Connecting to WebSocket for invitation (NOT for matchmaking)');
            this.connectWebSocket(false);  // Explicitly pass false

            // Wait for connection and then send invitation
            let connectionAttempts = 0;
            const maxAttempts = 5;

            const checkAndSendInvite = () => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.sendInvitation(username);
                } else {
                    connectionAttempts++;
                    if (connectionAttempts < maxAttempts) {
                        setTimeout(checkAndSendInvite, 500);
                    } else {
                        console.error("Failed to connect to WebSocket");
                        alert("Failed to connect to game server. Please try again.");
                    }
                }
            };

            setTimeout(checkAndSendInvite, 500);
        } else {
            // If already connected, send invitation directly
            this.sendInvitation(username);
        }
    }

    disableGameButtons(reason) {
        // Disable invite friends button
        if (this.inviteFriendsBtn) {
            this.inviteFriendsBtn.disabled = true;
            this.inviteFriendsBtn.classList.add('disabled');
            this.inviteFriendsBtn.title = reason || 'You have already sent an invitation';
        }

        // Disable matchmaking button
        if (this.matchmakingButton) {
            this.matchmakingButton.disabled = true;
            this.matchmakingButton.classList.add('disabled');
            this.matchmakingButton.title = reason || 'You have already sent an invitation';
            this.matchmakingButton.textContent = 'Invitation Sent';
        }
    }

    sendInvitation(username) {
        console.log(`Sending invitation to ${username}`);
        this.socket.send(JSON.stringify({
            type: 'invite_friend',
            friend_username: username
        }));
    }

    displayWelcomeScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        this.ctx.fillStyle = '#181818';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Pong Match', this.canvas.width / 2, 100);

        // Draw instructions
        this.ctx.font = '22px Noto';
        this.ctx.fillText('Click "Search for a game" to find an opponent', this.canvas.width / 2, 160);

        this.ctx.font = '18px Noto';
        this.ctx.fillText('Use up/down arrow keys to control your paddle', this.canvas.width / 2, 200);

        // Draw player info if currentUser is available
        if (typeof currentUser !== 'undefined' && currentUser) {
            const displayName = currentUser.nickname || currentUser.username;
            this.ctx.font = '24px Noto';
            this.ctx.fillText(`Player: ${displayName}`, this.canvas.width / 2, 260);
            this.ctx.fillText(`ELO: ${currentUser.elo}`, this.canvas.width / 2, 295);
        } else {
            // Display generic message if currentUser is not available
            this.ctx.font = '24px Noto';
            this.ctx.fillText('Ready to play', this.canvas.width / 2, 260);
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

        // Update button state immediately
        if (this.matchmakingButton) {
            this.matchmakingButton.disabled = true;
            this.matchmakingButton.textContent = 'Searching...';
        }

        // Disable invite button during matchmaking
        if (this.inviteFriendsBtn) {
            this.inviteFriendsBtn.disabled = true;
        }

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('Connecting to WebSocket for matchmaking...');
            this.connectWebSocket(true);  // This will send find_match once connected
        } else {
            // Socket already connected, send find_match directly
            console.log('WebSocket already connected, sending matchmaking request directly');
            this.socket.send(JSON.stringify({
                type: 'find_match'
            }));
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    connectWebSocket(useForMatchmaking = false) {
    // Store as instance property for access in callbacks
        this.useForMatchmaking = useForMatchmaking;
        console.log(`Connecting WebSocket (useForMatchmaking: ${useForMatchmaking})`);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new WebSocket(`${wsProtocol}${window.location.host}/ws/match/`);

        this.socket.onopen = () => {
            console.log('WebSocket connected for pong game');

            // Check if we have a saved game in sessionStorage
            const pendingGameData = sessionStorage.getItem('pendingGame');
            if (pendingGameData) {
                try {
                    const {gameId, opponentUsername, timestamp} = JSON.parse(pendingGameData);
                    // Only use if less than 30 seconds old to avoid using stale data
                    if (Date.now() - timestamp < 30000) {
                        console.log(`Restoring game from sessionStorage: ${gameId} with ${opponentUsername}`);
                        this.joinInvitedGame(gameId, opponentUsername, false);
                        // Clear after use
                        sessionStorage.removeItem('pendingGame');
                        return;
                    } else {
                        console.log("Pending game data expired, removing");
                        sessionStorage.removeItem('pendingGame');
                    }
                } catch (e) {
                    console.error("Error parsing pending game data:", e);
                    sessionStorage.removeItem('pendingGame');
                }
            }

            // Check for class property (pending invitation)
            if (this.pendingInvitedGame) {
                const { gameId, opponentUsername, isCreator } = this.pendingInvitedGame;
                this.pendingInvitedGame = null;
                this.joinInvitedGame(gameId, opponentUsername, isCreator);
                return;
            }

            // Check URL parameters as fallback
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('game');
            const opponent = urlParams.get('opponent');

            if (gameId && opponent) {
                console.log(`Joining game from URL parameters: ${gameId} with ${opponent}`);
                this.joinInvitedGame(gameId, opponent, false);
            }
            // Only send find_match if specifically requested AND not already handled
            else if (this.useForMatchmaking) {
                console.log("Sending find_match request to server");
                this.socket.send(JSON.stringify({
                    type: 'find_match'
                }));
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // console.log('Received data:', data);

                // Handle invitation accepted notification
                if (data.type === 'invitation_accepted') {
                    this.handleInvitationAccepted(data);
                }
                else {
                    this.handleMessage(data);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.socket.onclose = (event) => {
            console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);

            // Don't reconnect if we're intentionally closing
            if (!this.isPageUnloading) {
                // If we were in an active game, show a message
                if (this.isGameRunning) {
                    this.displayMessage("Connection lost. Attempting to reconnect...");
                }

                // Set a timeout to reconnect
                if (!this.reconnectTimeout) {
                    console.log("Scheduling reconnect...");
                    this.reconnectTimeout = setTimeout(() => {
                        console.log("Attempting to reconnect WebSocket...");
                        this.connectWebSocket(this.useForMatchmaking);
                        this.reconnectTimeout = null;
                    }, 2000);
                }
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Note: most browsers will call onclose after an error occurs
        };
    }

    handleInvitationAccepted(data) {
        console.log('Invitation accepted:', data);

        // Show notification
        const message = `${data.recipient_nickname || data.recipient_username} a accepté votre invitation!`;
        alert(message);

        // Save game data to session storage for persistence across navigation
        sessionStorage.setItem('pendingGame', JSON.stringify({
            gameId: data.game_id,
            opponentUsername: data.recipient_username,
            timestamp: Date.now(),
            isCreator: true  // Important: mark this user as the creator
        }));

        // Navigate to match page if we're not already there
        if (!window.location.pathname.includes('/match/')) {
            window.loadContent('/match/');
        } else {
            // We're already on the match page, just join the game
            console.log("Already on match page, joining game as creator");
            this.joinInvitedGame(data.game_id, data.recipient_username, true);
        }
    }

    joinInvitedGame(gameId, opponentUsername, isCreator) {
        console.log(`Joining invited game: ${gameId}, opponent: ${opponentUsername}, creator: ${isCreator}`);

        // Make sure we have a WebSocket connection
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // Store these parameters to use after connection
            this.pendingInvitedGame = { gameId, opponentUsername, isCreator };
            this.connectWebSocket(false);
            return;
        }

        // Update UI
        if (this.matchmakingButton) {
            this.matchmakingButton.textContent = "Dans un match...";
            this.matchmakingButton.disabled = true;
        }

        if (this.inviteFriendsBtn) {
            this.inviteFriendsBtn.disabled = true;
        }

        // Let server know we're joining an invited game
        this.socket.send(JSON.stringify({
            type: 'join_invited_game',
            game_id: gameId,
            opponent_username: opponentUsername,
            is_game_creator: isCreator
        }));

        // Show a message while waiting
        if (isCreator) {
            this.displayMessage(`Création de la partie avec ${opponentUsername}...`);
        } else {
            this.displayMessage(`Connexion à la partie avec ${opponentUsername}...`);
        }
    }

    handleMessage(data) {
        // console.log('Received message:', data);

        // Handle different message types
        if (data.type === 'match_created') {
            console.log('Match created!', data);
            // Save player number and start game
            this.playerNumber = data.player_number;
            this.isGameRunning = true;
            this.match_id = data.match_id;

            // Store player info
            if (data.game_state && data.game_state.player_info) {
                this.playerInfo = data.game_state.player_info;
            }

            // Update UI elements
            if (this.matchmakingButton) {
                this.matchmakingButton.textContent = "Dans un match...";
                this.matchmakingButton.disabled = true;
            }

            if (this.inviteFriendsBtn) {
                this.inviteFriendsBtn.disabled = true;
            }

            // Start drawing the game
            this.draw(data.game_state);

        } else if (data.type === 'game_state') {
            // Handle regular game state updates
            this.handleGameState(data.game_state);

        } else if (data.type === 'player_left') {
            // Handle player disconnection
            alert(`${data.player_username} a quitté la partie!`);
            this.stopGame();
            this.displayWelcomeScreen();

        } else if (data.type === 'game_over') {
            // Handle end of game
            const winner = data.winner;
            const currentUsername = currentUser ? currentUser.username : null;
            const message = winner === currentUsername
                ? "Félicitations! Vous avez gagné!"
                : `${winner} a gagné la partie!`;

            alert(message);
            this.stopGame();
            this.displayWelcomeScreen();

			setTimeout(() => {
				if (window.gameInvitationsManager) {
					window.gameInvitationsManager.resetInvitations();
				}
			}, 1000);

        } else if (data.type === 'matchmaking_status' || data.type === 'waiting') {
            // Handle matchmaking status updates
            this.displayMatchmakingStatus(data);

        } else if (data.type === 'waiting_for_opponent') {
            // Handle waiting for opponent
            this.displayMessage(data.message);

        } else if (data.type === 'waiting_for_creator') {
            // Handle waiting for creator
            this.displayMessage(data.message);

        } else if (data.type === 'friend_invite_sent') {
            // Handle successful friend invitation
            console.log('Friend invite sent:', data);

        } else if (data.type === 'friend_invite_error') {
            // Handle friend invitation error
            console.error('Friend invite error:', data);
            alert(data.message);

        } else {
            // Log unknown message types
            console.log('Unhandled message type:', data.type);
        }
    }

    cancelPendingInvitations() {
        console.log("Cancelling pending invitations...");

        // Get CSRF token for the request
        const csrfToken = this.getCookie('csrftoken');

        // Create a synchronous XHR request to ensure it completes before navigation
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/invitations/cancel/', false); // false = synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-CSRFToken', csrfToken);
        xhr.withCredentials = true;

        // Log request start
        console.log("Sending cancellation request...");

        // Send the request
        try {
            xhr.send();

            // Log response status
            console.log("Cancellation request status:", xhr.status);

            // Process response if successful
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    console.log("Cancelled invitations:", response.message);

                    // Use localStorage to broadcast cancellation to other tabs
                    if (response.affected_recipients && response.affected_recipients.length > 0) {
                        // Create a unique key with timestamp to trigger events in other tabs
                        const storageKey = `invitation_cancelled_${Date.now()}`;
                        localStorage.setItem(storageKey, JSON.stringify(response.affected_recipients));
                        console.log("Broadcast cancellation via localStorage:", storageKey);
                    }
                } catch (e) {
                    console.error("Error parsing cancellation response:", e);
                }
            } else {
                console.error("Failed to cancel invitations:", xhr.status, xhr.statusText);
            }
        } catch (e) {
            console.error("Exception during invitation cancellation:", e);
        }
    }

    broadcastCancellation(recipientIds) {
        // Broadcast to each affected recipient via browser storage
        recipientIds.forEach(id => {
            // Use localStorage with unique per-recipient keys
            localStorage.setItem(`invitation_cancelled_for_${id}`, Date.now());
        });
    }

    handleGameState(gameState) {
        // Update player info if available
        if (gameState.player_info) {
            this.playerInfo = gameState.player_info;
        }

        // Draw the updated game state
        this.draw(gameState);
    }

    displayMatchmakingStatus(data) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message || "Searching for opponent...", this.canvas.width / 2, this.canvas.height / 2 - 40);

        const status = data.matchmaking_status || {};

        this.ctx.font = '20px Noto';
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

        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    cleanup() {
        console.log("[PongServerGame CLEANUP]: Cleaning up resources...");
    
        // Mark as unloading to prevent reconnection attempts
        this.isPageUnloading = true;
    
        // Close WebSocket connections
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log("[PongServerGame CLEANUP]: Closing game WebSocket...");
            this.socket.close(1000, "Cleaning up before navigation");
        }
    
        if (this.notificationSocket && this.notificationSocket.readyState === WebSocket.OPEN) {
            console.log("[PongServerGame CLEANUP]: Closing notification WebSocket...");
            this.notificationSocket.close(1000, "Cleaning up notifications");
        }
    
        // Cancel any pending tasks
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
    
        // Reset game state
        this.isGameRunning = false;
        this.playerNumber = null;
        this.match_id = null;
        this.pendingInvitedGame = null;
    
        console.log("[PongServerGame CLEANUP]: Cleanup completed.");
    }

    stopGame() {
        console.log("Stopping game and cleaning up resources");
        this.isGameRunning = false;
        this.playerNumber = null;
		this.match_id = null;
		this.pendingInvitedGame = null;
		this.useForMatchmaking = false;

        // Cancel any pending matchmaking
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify({
                    type: 'cancel_matchmaking'
                }));
            } catch (e) {
                console.error("Error sending cancel matchmaking:", e);
            }
        }

        // Cancel any pending invitations
        try {
            this.cancelPendingInvitations();
        } catch (e) {
            console.error("Error cancelling invitations:", e);
        }

        // Re-enable UI buttons
        if (this.matchmakingButton) {
            this.matchmakingButton.disabled = false;
            this.matchmakingButton.textContent = 'Search for a game';
			this.matchmakingButton.classList.remove('disabled');
			this.matchmakingButton.title = '';
        }

        if (this.inviteFriendsBtn) {
            this.inviteFriendsBtn.disabled = false;
			this.inviteFriendsBtn.classList.remove('disabled');
			this.inviteFriendsBtn.title = '';
        }

		if (this.friendInviteManager) {
			this.friendInviteManager.hasInvitedSomeone = false;
		}
    }

    draw(gameState) {
        if (!gameState) {
            console.error("No game state to draw");
            return;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw paddles
        this.ctx.fillStyle = '#333';
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
        this.ctx.fillRect(
            gameState.ball.x,
            gameState.ball.y,
            15, 15
        );

        // Draw scores
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Noto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gameState.score.player1, this.canvas.width / 2 - 30, 30);
        this.ctx.fillText(":", this.canvas.width / 2, 30);
        this.ctx.fillText(gameState.score.player2, this.canvas.width / 2 + 30, 30);

        // Draw player names with nicknames if available
        const player1Display = this.playerInfo.player1.nickname || this.playerInfo.player1.username;
        const player2Display = this.playerInfo.player2.nickname || this.playerInfo.player2.username;

        this.ctx.font = '20px Noto';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${player1Display} (${this.playerInfo.player1.elo})`, 20, 20);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${player2Display} (${this.playerInfo.player2.elo})`, this.canvas.width - 20, 20);
    }

    declareForfeit() {

        console.log("Declaring forfeit for current game before navigation");

        try {
            // 1. First send an explicit forfeit message
            this.socket.send(JSON.stringify({
                type: 'declare_forfeit',
                match_id: this.match_id
            }));

            // 2. Mark as forfeiting to prevent reconnection attempts
            this.isForfeiting = true;
            this.isGameRunning = false;

            // 3. Close the WebSocket connection
            this.socket.close(1000, "User forfeited game");

            console.log("Forfeit signal sent and socket closed");
        } catch (e) {
            console.error("Error sending forfeit:", e);
        }
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

window.initUserData = function() {
    // Check if currentUser is not defined
    if (typeof currentUser === 'undefined') {
        // Try to get user info from window.currentUser (if set elsewhere)
        if (typeof window.currentUser !== 'undefined') {
            window.currentUser = window.currentUser;
        } else {
            // Create a placeholder user object from sessionStorage if available
            const userData = sessionStorage.getItem('userData');
            if (userData) {
                try {
                    window.currentUser = JSON.parse(userData);
                } catch (e) {
                    console.warn('Failed to parse user data from sessionStorage');
                    // Create minimal placeholder
                    window.currentUser = {
                        username: 'Player',
                        nickname: '',
                        elo: 1000
                    };
                }
            } else {
                // Set a default placeholder user if nothing else is available
                window.currentUser = {
                    username: 'Player',
                    nickname: '',
                    elo: 1000
                };
            }
        }
    }
};

window.cancelPendingPongInvitations = function() {
    console.log("Global invitation cancellation triggered");
    try {
        // If pongServerGame exists, use it
        if (window.pongServerGame) {
            console.log("CANCEL INVITE");
            window.pongServerGame.cancelPendingInvitations();
        } else {
            console.log("No active PongServerGame instance. Skipping invitation cancellation.");
        }
        console.log("Invitations cancelled successfully via global function");
    } catch (error) {
        console.error("Error in global invitation cancellation:", error);
    }
};

window.declarePongForfeit = function() {
    console.log("Global forfeit declaration triggered");

    try {
        console.log("PongServerGame exists:", !!window.pongServerGame);

        // Case 1: Use the existing game instance if available
        if (window.pongServerGame && window.pongServerGame.socket) {
            console.log("Found active pongServerGame, sending forfeit via WebSocket");

            if (window.pongServerGame.socket.readyState === WebSocket.OPEN) {
                // Send forfeit message with match_id if we have it
                window.pongServerGame.socket.send(JSON.stringify({
                    type: 'declare_forfeit',
                    match_id: window.pongServerGame.match_id || ''
                }));

                // Force close the socket
                window.pongServerGame.socket.onclose = null; // Remove reconnect handler
                window.pongServerGame.socket.close(1000, "User navigated away");
                console.log("Socket forcibly closed for forfeit");

                // Set flags to prevent reconnection
                window.pongServerGame.isPageUnloading = true;
                window.pongServerGame.isGameRunning = false;

                return true;
            }
        }
        // Case 2: Direct API call as fallback when no game instance exists
        else {
            console.log("No active pongServerGame, using API fallback");

            // Make a synchronous API call to forfeit
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/match/forfeit/', false); // false = synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');

            // Get CSRF token from cookie if available
            const csrfToken = document.cookie
                .split('; ')
                .find(cookie => cookie.startsWith('csrftoken='))
                ?.split('=')[1];

            if (csrfToken) {
                xhr.setRequestHeader('X-CSRFToken', csrfToken);
            }

            // Send the forfeit request
            try {
                xhr.send();
                console.log("Forfeit API response:", xhr.status);
                return true;
            } catch (e) {
                console.error("Forfeit API call failed:", e);
            }
        }

        return false;
    } catch (error) {
        console.error("Error in global forfeit declaration:", error);
        return false;
    }
};

window.initPongServerGame = function() {
    // Only create the instance if it doesn't already exist
    if (!window.pongServerGame) {
        console.log('Creating pongServerGame instance from initPongServerGame');
        window.pongServerGame = new PongServerGame();
    } else {
        console.log('pongServerGame instance already exists, skipping creation');
    }
};
