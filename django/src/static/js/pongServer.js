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
		this.notificationReconnectTimeout = null;
		this.playerNumber = null;
		this.playerInfo = {
			player1: { username: "", nickname: "", elo: 0 },
			player2: { username: "", nickname: "", elo: 0 }
		};
		this.keysPressed = {};
		this.friendInviteManager = null;
		this.authenticated = true;


		// SETUP INVITE
		const urlParams = new URLSearchParams(window.location.search);
		const gameId = urlParams.get('game');
		const opponent = urlParams.get('opponent');
		if (gameId && opponent) {
			console.log(`Found invitation parameters in URL: game=${gameId}, opponent=${opponent}`);
			this.pendingInvitedGame = {
				gameId,
				opponentUsername: opponent,
				isCreator: false
			};
			this.init(true);
		} else {
			this.init(false);
		}

		// SETUP NOTIFICATION
		this.setupNotificationSocket();
	}

	//==========================================================//
	//                 INIT                                     //
	//==========================================================//

	init(hasInvitation = false) {
		console.log('[PONGSERVER]:Initializing PongServerGame' + (hasInvitation ? ' with invitation' : ''));
		window.initUserData();
		if (this.matchmakingButton) {
			console.log('[PONGSERVER]:Matchmaking button found');
			this.matchmakingButton.addEventListener('click', () => this.startMatchmaking());
		} else {
			console.log('[PONGSERVER]:Matchmaking button not found');
		}


		// HANDLE INVITE
		if (this.inviteFriendsBtn) {
			console.log('[PONGSERVER]:Invite friends button found');
			this.inviteFriendsBtn.addEventListener('click', () => {
				this.initFriendInviteManager();
				this.friendInviteManager.showDialog();
			});
		} else {
			console.log('[PONGSERVER]:Invite friends button not found');
		}

		this.addEventListeners();

		if (hasInvitation && this.pendingInvitedGame) {
			console.log('[PONGSERVER]:Connecting to WebSocket for pending invitation');
			this.connectWebSocket(false);
		} else {
			// NO INVITE
			this.displayWelcomeScreen();
		}
	}

	//==========================================================//
	//                 SOCKET                                   //
	//==========================================================//

	// NOTIFICATION

	setupNotificationSocket() {
		const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
		this.notificationSocket = new WebSocket(`${wsProtocol}${window.location.host}/ws/notifications/`);

		this.notificationSocket.onopen = () => {
			console.log('[PONGSERVER]:Notification WebSocket connected');
		};

		this.notificationSocket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				console.log('[PONGSERVER]:Notification received:', data);

				if (data.type === 'invitation_accepted') {
					this.handleInvitationAccepted(data);
				}
			} catch (error) {
				console.log('[PONGSERVER]:Error processing notification:', error);
			}
		};

		this.notificationSocket.onclose = (event) => {
			console.log('[PONGSERVER]:Notification WebSocket disconnected');
			
			// RECONNEXION
			if (!this.isPageUnloading) {
				console.log('[PONGSERVER]:Scheduling notification socket reconnect...');
				this.notificationReconnectTimeout = setTimeout(() => {
					console.log('[PONGSERVER]:Attempting notification socket reconnect...');
					this.setupNotificationSocket();
				}, 2000);
			} else {
				console.log('[PONGSERVER]:Page unloading - skipping notification socket reconnect');
			}
		};
	}

	// SOCKET CONNECTION

	connectWebSocket(useForMatchmaking = false) {
			this.useForMatchmaking = useForMatchmaking;
			console.log(`[PONGSERVER]:Connecting WebSocket (useForMatchmaking: ${useForMatchmaking})`);
	
			const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
			this.socket = new WebSocket(`${wsProtocol}${window.location.host}/ws/match/`);
	
			this.socket.onopen = () => {

				console.log('[PONGSERVER]:WebSocket connected for pong game');
				const pendingGameData = sessionStorage.getItem('pendingGame');
				
				// HANDLE PENDING INVITE
				if (pendingGameData) {
					try {
						const {gameId, opponentUsername, timestamp} = JSON.parse(pendingGameData);
						if (Date.now() - timestamp < 30000) {
							console.log(`[PONGSERVER]:Restoring game from sessionStorage: ${gameId} with ${opponentUsername}`);
							this.joinInvitedGame(gameId, opponentUsername, false);
							sessionStorage.removeItem('pendingGame');
							return;
						} else {
							console.log("[PONGSERVER]:Pending game data expired, removing");
							sessionStorage.removeItem('pendingGame');
						}
					} catch (e) {
						console.error("[PONGSERVER]:Error parsing pending game data:", e);
						sessionStorage.removeItem('pendingGame');
					}
				}
	
				if (this.pendingInvitedGame) {
					const { gameId, opponentUsername, isCreator } = this.pendingInvitedGame;
					this.pendingInvitedGame = null;
					this.joinInvitedGame(gameId, opponentUsername, isCreator);
					return;
				}
	
				const urlParams = new URLSearchParams(window.location.search);
				const gameId = urlParams.get('game');
				const opponent = urlParams.get('opponent');
	
				if (gameId && opponent) {
					console.log(`[PONGSERVER]:Joining game from URL parameters: ${gameId} with ${opponent}`);
					this.joinInvitedGame(gameId, opponent, false);
				}
				
				// HANDLE MATCHMAKING
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
	
					// HANDLE INVITE ACCEPTED NOTIFICATION
					if (data.type === 'invitation_accepted') {
						this.handleInvitationAccepted(data);
					}
					else {
						this.handleMessage(data);
					}
				} catch (error) {
					console.log('[PONGSERVER]:Error parsing WebSocket message:', error);
				}
			};
	
			this.socket.onclose = (event) => {
				console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
	
				// NO RECONNECTION IN CASE OF ACTIVE LEAVING
				if (!this.isPageUnloading) {
					if (this.isGameRunning) {
						this.displayMessage("Connection lost. Attempting to reconnect...");
					}
					// RECONNECTION
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
				console.log('[PONGSERVER]:WebSocket error:', error);
			};
		}

	//==========================================================//
	//                 INVITE                                   //
	//==========================================================//

	initFriendInviteManager() {
		if (!this.friendInviteManager) {
			this.friendInviteManager = new FriendInviteManager({
				title: 'Inviter des amis à jouer',
				socket: this.socket,
				onInviteSent: (username) => this.handleFriendInvite(username),
				onDialogClosed: () => console.log('[PONGSERVER]:Invite dialog closed')
			});
		}
	}

	handleFriendInvite(username) {
		console.log(`[PONGSERVER]:Pong Game handling friend invite for: ${username}`);

		// IN CASE OF GAME IS RUNNING
		if (this.isGameRunning) {
			this.stopGame();
		}
		// CREATE AND CONNECT SOCKET IN CASE OF INVITATION
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.log('[PONGSERVER]:Connecting to WebSocket for invitation (NOT for matchmaking)');
			this.connectWebSocket(false);

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
						console.error("[PONGSERVER]: Failed to connect to WebSocket");
						alert("Failed to connect to game server. Please try again.");
					}
				}
			};

			setTimeout(checkAndSendInvite, 500);
		} else {
			this.sendInvitation(username);
		}
	}

	sendInvitation(username) {
		console.log(`Sending invitation to ${username}`);
		this.socket.send(JSON.stringify({
			type: 'invite_friend',
			friend_username: username
		}));
	}

	handleInvitationAccepted(data) {
		console.log('[PONGSERVER]:Invitation accepted:', data);

		// SHOW ACCEPTED INVITE NOTIFICATION
		const message = `${data.recipient_nickname || data.recipient_username} accept your challenge!`;
		alert(message);

		// SAVE GAME DATA FOR NAVIGATION
		sessionStorage.setItem('pendingGame', JSON.stringify({
			gameId: data.game_id,
			opponentUsername: data.recipient_username,
			timestamp: Date.now(),
			isCreator: true
		}));

		// LOAD MATCH CONTENT FROM OTHER PAGE
		if (!window.location.pathname.includes('/match/')) {
			window.loadContent('/match/');
		} else {
			// LAUNCH MATCH
			console.log("Already on match page, joining game as creator");
			this.joinInvitedGame(data.game_id, data.recipient_username, true);
		}
	}

	joinInvitedGame(gameId, opponentUsername, isCreator) {
		console.log(`Joining invited game: ${gameId}, opponent: ${opponentUsername}, creator: ${isCreator}`);

		// CHECK FOR SOCKET OPENING
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			this.pendingInvitedGame = { gameId, opponentUsername, isCreator };
			this.connectWebSocket(false);
			return;
		}

		// UPDATE BUTTON
		if (this.matchmakingButton) {
			this.matchmakingButton.textContent = "Dans un match...";
			this.matchmakingButton.disabled = true;
		}
		if (this.inviteFriendsBtn) {
			this.inviteFriendsBtn.disabled = true;
		}

		// NOTIFY SERVER SIDE
		this.socket.send(JSON.stringify({
			type: 'join_invited_game',
			game_id: gameId,
			opponent_username: opponentUsername,
			is_game_creator: isCreator
		}));

		// LOADING SCREEN
		if (isCreator) {
			this.displayMessage(`Création de la partie avec ${opponentUsername}...`);
		} else {
			this.displayMessage(`Connexion à la partie avec ${opponentUsername}...`);
		}
	}

	cancelPendingInvitations() {
		console.log("[PONGSERVER]:Cancelling pending invitations...");

		const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");

		// SYNCHRONOUS XHR FOR NOTIFICATION WITHOUT REFRESH (FALSE=SYNC)
		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/invitations/cancel/', false);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('X-CSRFToken', csrfToken);
		xhr.withCredentials = true;

		try {
			xhr.send();
			console.log("[PONGSERVER]:Cancellation request status:", xhr.status);

			// RESPONSE IS SUCCESSFULL
			if (xhr.status === 200) {
				try {
					const response = JSON.parse(xhr.responseText);
					console.log("[PONGSERVER]:Cancelled invitations:", response.message);

					// LOCAL BROADCAST TO OTHER PAGE
					if (response.affected_recipients && response.affected_recipients.length > 0) {
						const storageKey = `invitation_cancelled_${Date.now()}`;
						localStorage.setItem(storageKey, JSON.stringify(response.affected_recipients));
						console.log("[PONGSERVER]:Broadcast cancellation via localStorage:", storageKey);
					}
				} catch (e) {
					console.error("[PONGSERVER]:Error parsing cancellation response:", e);
				}
			} else {
				console.error("[PONGSERVER]:Failed to cancel invitations:", xhr.status, xhr.statusText);
			}
		} catch (e) {
			console.error("[PONGSERVER]:Exception during invitation cancellation:", e);
		}
	}

	broadcastCancellation(recipientIds) {
		recipientIds.forEach(id => {
			localStorage.setItem(`invitation_cancelled_for_${id}`, Date.now());
		});
	}


	//==========================================================//
	//                 DYNAMIC                                  //
	//==========================================================//

	disableGameButtons(reason) {
		if (this.inviteFriendsBtn) {
			this.inviteFriendsBtn.disabled = true;
			this.inviteFriendsBtn.classList.add('disabled');
			this.inviteFriendsBtn.title = reason || 'You have already sent an invitation';
		}
		if (this.matchmakingButton) {
			this.matchmakingButton.disabled = true;
			this.matchmakingButton.classList.add('disabled');
			this.matchmakingButton.title = reason || 'You have already sent an invitation';
			this.matchmakingButton.textContent = 'Invitation Sent';
		}
	}

	handleMessage(data) {

		// IN CASE OF MATCH
		if (data.type === 'match_created') {
			console.log('[PONGSERVER]:Match created!', data);
			this.playerNumber = data.player_number;
			this.isGameRunning = true;
			this.match_id = data.match_id;
			if (data.game_state && data.game_state.player_info) {
				this.playerInfo = data.game_state.player_info;
			}
			if (this.matchmakingButton) {
				this.matchmakingButton.textContent = "Dans un match...";
				this.matchmakingButton.disabled = true;
			}
			if (this.inviteFriendsBtn) {
				this.inviteFriendsBtn.disabled = true;
			}

			// DISPLAY GAME
			this.draw(data.game_state);

		// DURING MATCH
		} else if (data.type === 'game_state') {
			this.handleGameState(data.game_state);
			
		// IF FORFEIT IS DECLARED
		} else if (data.type === 'player_left') {
			const leftPlayer = data.player_username;
			const message = `${leftPlayer} left the game! You win.`;
			alert(message);
			this.stopGame();
			// this.displayWelcomeScreen();
			setTimeout(() => {
				if (window.gameInvitationsManager) {
					window.gameInvitationsManager.resetInvitations();
				}
			}, 1000);
		
		// IF GAME IS TERMINATED
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

		// DURING MATCHMAKING
		} else if (data.type === 'matchmaking_status' || data.type === 'waiting') {
			this.displayMatchmakingStatus(data);

		// WHEN MATCHMAKING IS ACCEPTED
		} else if (data.type === 'waiting_for_opponent') {
			this.displayMessage(data.message);
		} else if (data.type === 'waiting_for_creator') {
			this.displayMessage(data.message);

		// INVITATION
		} else if (data.type === 'friend_invite_sent') {
			console.log('[PONGSERVER]:Friend invite sent:', data);
		} else if (data.type === 'friend_invite_error') {
			console.log('[PONGSERVER]:Friend invite error:', data);
			alert(data.message);
		
		// DEBUG
		} else {
			console.log('[PONGSERVER]:Unhandled message type:', data.type);
		}
	}

	handleGameState(gameState) {
		// NO GAME
		if (!this.isGameRunning) {
			console.log("Ignoring game state update - game is no longer running");
			return;
		}
	
		// PLAYER INFO IF GAME
		if (gameState.player_info) {
			this.playerInfo = gameState.player_info;
		}

		// DISPLAY GAME
		this.draw(gameState);
	}

	declareForfeit() {
		console.log("[PONGSERVER]:Declaring forfeit for current game before navigation");

		try {
			// FORFEIT MESSAGE
			this.socket.send(JSON.stringify({
				type: 'declare_forfeit',
				match_id: this.match_id
			}));

			// FORFEIT STATUS
			this.isForfeiting = true;
			this.isGameRunning = false;

			// CLOSE SOCKET
			this.socket.close(1000, "[PONGSERVER]:User forfeited game");

			console.log("[PONGSERVER]:Forfeit signal sent and socket closed");
		} catch (e) {
			console.error("[PONGSERVER]:Error sending forfeit:", e);
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

	//==========================================================//
	//                 DISPLAY                                  //
	//==========================================================//

	displayWelcomeScreen() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// BACKGROUND
		this.ctx.fillStyle = '#181818';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// TITLE
		this.ctx.fillStyle = '#fff';
		this.ctx.font = '30px Noto';
		this.ctx.textAlign = 'center';
		this.ctx.fillText('Pong Match', this.canvas.width / 2, 100);

		// RESUME
		this.ctx.font = '22px Noto';
		this.ctx.fillText('Click "Search for a game" to find an opponent', this.canvas.width / 2, 160);
		this.ctx.font = '18px Noto';
		this.ctx.fillText('Use up/down arrow keys to control your paddle', this.canvas.width / 2, 200);

		// PLAYER INFO
		if (typeof currentUser !== 'undefined' && currentUser) {
			const displayName = currentUser.nickname || currentUser.username;
			this.ctx.font = '24px Noto';
			this.ctx.fillText(`Player: ${displayName}`, this.canvas.width / 2, 260);
			this.ctx.fillText(`ELO: ${currentUser.elo}`, this.canvas.width / 2, 295);
		} else {
			// IN CASE OF PLAYER INFO FETCH FAILED
			this.ctx.font = '24px Noto';
			this.ctx.fillText('Ready to play', this.canvas.width / 2, 260);
		}

		// PONG ICON
		this.ctx.fillStyle = '#333';
		this.ctx.fillRect(this.canvas.width/2 - 80, 330, 20, 70);
		this.ctx.fillRect(this.canvas.width/2 + 60, 330, 20, 70);
		this.ctx.beginPath();
		this.ctx.arc(this.canvas.width/2, 365, 10, 0, Math.PI * 2);
		this.ctx.fill();
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

		// ANIMATED DOTS
		const now = Date.now();
		const dotCount = Math.floor((now % 3000) / 1000) + 1;
		const dots = '.'.repeat(dotCount);
		this.ctx.fillText(`Searching${dots}`, this.canvas.width / 2, this.canvas.height / 2 + 120);
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

	draw(gameState) {
		if (!gameState) {
			console.error("No game state to draw");
			return;
		}

		// CLEAR CANVAS
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// PADDLES
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

		// BALL
		this.ctx.fillStyle = 'white';
		this.ctx.fillRect(
			gameState.ball.x,
			gameState.ball.y,
			15, 15
		);

		// SCORES
		this.ctx.fillStyle = 'white';
		this.ctx.font = '30px Noto';
		this.ctx.textAlign = 'center';
		this.ctx.fillText(gameState.score.player1, this.canvas.width / 2 - 30, 30);
		this.ctx.fillText(":", this.canvas.width / 2, 30);
		this.ctx.fillText(gameState.score.player2, this.canvas.width / 2 + 30, 30);

		// NAME
		const player1Display = this.playerInfo.player1.nickname || this.playerInfo.player1.username;
		const player2Display = this.playerInfo.player2.nickname || this.playerInfo.player2.username;
		this.ctx.font = '20px Noto';
		this.ctx.textAlign = 'left';
		this.ctx.fillText(`${player1Display} (${this.playerInfo.player1.elo})`, 20, 20);
		this.ctx.textAlign = 'right';
		this.ctx.fillText(`${player2Display} (${this.playerInfo.player2.elo})`, this.canvas.width - 20, 20);
	}

	//==========================================================//
	//                 MATCHMAKING                              //
	//==========================================================//

	startMatchmaking() {
		console.log('[PONGSERVER]:Matchmaking started...');

		// COVER BUTTON DURING MATCH
		if (this.matchmakingButton) {
			this.matchmakingButton.disabled = true;
			this.matchmakingButton.textContent = 'Searching...';
		}

		// DISABLE INVITE
		if (this.inviteFriendsBtn) {
			this.inviteFriendsBtn.disabled = true;
		}

		// GET SOCKET
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.log('[PONGSERVER]:Connecting to WebSocket for matchmaking...');
			this.connectWebSocket(true);
		} else {
			console.log('[PONGSERVER]:WebSocket already connected, sending matchmaking request directly');
			this.socket.send(JSON.stringify({
				type: 'find_match'
			}));
		}
	}

	//==========================================================//
	//                 CLEANUP                                  //
	//==========================================================//

	cleanup() {
		console.log("[PONGSERVER]: Cleaning up resources...");
	
		// NO RECONNECTION ATTEMPT ALLOWED
		this.isPageUnloading = true;
	
		// CLOSE SOCKET
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			console.log("[PONGSERVER]: Closing game WebSocket...");
			this.socket.close(1000, "Cleaning up before navigation");
		}
	
		if (this.notificationSocket && this.notificationSocket.readyState === WebSocket.OPEN) {
			console.log("[PONGSERVER]: Closing notification WebSocket...");
			this.notificationSocket.close(1000, "Cleaning up notifications");
		}
	
		// CANCEL ANY PENDING RECONNECTION
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.notificationReconnectTimeout) {
			clearTimeout(this.notificationReconnectTimeout);
			this.notificationReconnectTimeout = null;
		}
	
		// RESET GAME STATE
		this.isGameRunning = false;
		this.playerNumber = null;
		this.match_id = null;
		this.pendingInvitedGame = null;
	
		console.log("[PONGSERVER]:Cleanup completed.");
	}

	stopGame() {
		console.log("[PONGSERVER]:Stopping game and cleaning up resources");
		
		// CLEAR CANVAS
		if (this.ctx && this.canvas) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
		
		// RESET GAME DATA
		this.isGameRunning = false;
		this.playerNumber = null;
		this.match_id = null;
		this.pendingInvitedGame = null;
		this.useForMatchmaking = false;
		this.playerInfo = {
			player1: { username: "", nickname: "", elo: 0 },
			player2: { username: "", nickname: "", elo: 0 }
		};

		// DEBUG CANCEL ANY MATCHMAKING
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			try {
				this.socket.send(JSON.stringify({
					type: 'cancel_matchmaking'
					}));
				
				console.log("[PONGSERVER]: Closing WebSocket connection after game end");
				this.socket.onclose = null;
				this.socket.close(1000, "Game ended normally");
				this.socket = null;
			} catch (e) {
				console.error("[PONGSERVER]: Error closing game socket:", e);
			}
		}

		// DEBUG CANCEL ANY INVITE
		try {
			this.cancelPendingInvitations();
		} catch (e) {
			console.error("[PONGSERVER]: Error cancelling invitations:", e);
		}

		// ACTIVATE BUTTON
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

		// CANCEL INVITE
		if (this.friendInviteManager) {
			this.friendInviteManager.hasInvitedSomeone = false;
			}

		// Afficher l'écran d'accueil après la fin du jeu
		this.displayWelcomeScreen();
	}

	//==========================================================//
	//                 WINDOW                                   //
	//==========================================================//

	addEventListeners() {
		
		// PLAYER MOVEMENT
		document.addEventListener('keydown', (e) => {
			if (!this.isGameRunning) return;
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				this.keysPressed.up = true;
				this.sendInput(-1);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.keysPressed.down = true;
				this.sendInput(1);
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

		// PAGE UNLOAD
		window.addEventListener('beforeunload', () => {
			this.isPageUnloading = true;
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.close();
			}
		});
	}
}

window.initUserData = function() {
	// CHECK CURRENT USER
	if (typeof currentUser === 'undefined') {
		// GET USER DATA
		if (typeof window.currentUser !== 'undefined') {
			window.currentUser = window.currentUser;
		} else {
			// IN CASE OF NO DATA, CREATE PLACEHOLDER
			const userData = sessionStorage.getItem('userData');
			if (userData) {
				try {
					window.currentUser = JSON.parse(userData);
				} catch (e) {
					console.warn('Failed to parse user data from sessionStorage');
					// CREATE MINIMAL PLACEHOLDER
					window.currentUser = {
						username: 'Player',
						nickname: '',
						elo: 1000
					};
				}
			} else {
				// EXCEPTION: CREATE DEFAULT PLACEHOLDER
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
	console.log("[PONGSERVER]: Global invitation cancellation triggered");
	try {
		if (window.pongServerGame) {
			console.log("[PONGSERVER]: Cancelling pong invitation");
			window.pongServerGame.cancelPendingInvitations();
		} else {
			console.log("[PONGSERVER]: No active PongServerGame instance. Skipping invitation cancellation.");
		}
		console.log("[PONGSERVER]: Invitations cancelled successfully via global function");
	} catch (error) {
		console.error("[PONGSERVER]: Error in global invitation cancellation:", error);
	}
};

window.declarePongForfeit = function() {
	console.log("[PONGSERVER]:Global forfeit declaration triggered");

	try {
		console.log("[PONGSERVER]:PongServerGame exists:", !!window.pongServerGame);

		// DELETE EXISTING GAME INSTANCE
		if (window.pongServerGame && window.pongServerGame.socket) {
			console.log("[PONGSERVER]:Found active pongServerGame, sending forfeit via WebSocket");

			if (window.pongServerGame.socket.readyState === WebSocket.OPEN) {
				window.pongServerGame.socket.send(JSON.stringify({
					type: 'declare_forfeit',
					match_id: window.pongServerGame.match_id || ''
				}));
				window.pongServerGame.socket.onclose = null; // Remove reconnect handler
				window.pongServerGame.socket.close(1000, "User navigated away");
				console.log("[PONGSERVER]:Socket forcibly closed for forfeit");
				window.pongServerGame.isPageUnloading = true;
				window.pongServerGame.isGameRunning = false;
				return true;
			}
		}

		// API FALLBACK
		else {
			console.log("[PONGSERVER]:No active pongServerGame, using API fallback");
			const xhr = new XMLHttpRequest();
			xhr.open('POST', '/api/match/forfeit/', false); // false = synchronous
			xhr.setRequestHeader('Content-Type', 'application/json');
			const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
			if (csrfToken) {
				xhr.setRequestHeader('X-CSRFToken', csrfToken);
			}
			try {
				xhr.send();
				console.log("[PONGSERVER]:Forfeit API response:", xhr.status);
				return true;
			} catch (e) {
				console.error("[PONGSERVER]:Forfeit API call failed:", e);
			}
		}

		return false;
	} catch (error) {
		console.error("[PONGSERVER]:Error in global forfeit declaration:", error);
		return false;
	}
};

window.initPongServerGame = function() {
	if (!window.pongServerGame) {
		console.log('[PONGSERVER]:Creating pongServerGame instance from initPongServerGame');
		window.pongServerGame = new PongServerGame();
	} else {
		console.log('[PONGSERVER]:pongServerGame instance already exists, skipping creation');
	}
};
