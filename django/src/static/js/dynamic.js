document.addEventListener('DOMContentLoaded', function () {
	let pongGame = null;
	let pongServerGame = null;
	let snakeGame = null;
	updateAuthButtons();

	function attachFooterButtonEvents() {
		document.querySelectorAll('.footer-button').forEach(function (button) {
			// Supprimer les anciens gestionnaires pour éviter les doublons
			button.removeEventListener('click', handleFooterButtonClick);
			button.addEventListener('click', handleFooterButtonClick);
		});
	}

	// Gestionnaire d'événements pour les clics sur les boutons du footer
	function handleFooterButtonClick(event) {
		event.preventDefault();
		const url = event.currentTarget.getAttribute('data-url');
		if (window.location.pathname !== new URL(url, window.location.origin).pathname) {
			window.loadContent(url);
		}
	}

	window.loadContent = function(url, addToHistory = true) {

		window.isDynamicLoading = true;

		console.log(`Navigation initiated to ${url}`);
		console.log("Starting cleanup before navigation");
		cleanupScriptsAndEvents();

		fetch(url, {
			headers: {
				'X-Requested-With': 'XMLHttpRequest'
			}
		})
			.then(response => response.text())
			.then(html => {
				document.getElementById('content').innerHTML = html;
				const scripts = document.querySelectorAll('#content script');
				scripts.forEach(script => {
					const scriptUrl = script.src;
					if (scriptUrl) {
						loadScript(scriptUrl, function () {
							if (scriptUrl.includes('local.js')) {
								initPong();
							}
							if (scriptUrl.includes('vsBot.js')) {
								initBot();
							}
							if (scriptUrl.includes('pongServer.js')) {
								initPongServer();
							}
							if (scriptUrl.includes('tournamentClient.js')) {
								initPongTournament();
							}
							// if (scriptUrl.includes('leaderboard.js')) {
							// 	loadLeaderboard();
							// }
							if (scriptUrl.includes('register.js')) {
								registerFormEvent();
							}
							if (scriptUrl.includes('login.js')) {
								loginFormEvent();
							}
							if (scriptUrl.includes('verify_code.js')) {
								verifyCodeFormEvent();
							}
							if (scriptUrl.includes('auth-header.js')) {
								updateAuthButtons();
							}
							if (scriptUrl.includes('account.js')) {
								window.initAccountPage();
							}
							if (scriptUrl.includes('animationPong.js')) {
								initPongAnimation();
							}
							if (scriptUrl.includes('sphere-animation.js')) {
								initSphereAnimation();
							}
							// if (scriptUrl.includes('leaderboard.js')) {
							// 	loadLeaderboardPage();
							// }
							if (scriptUrl.includes('snake.js')) {
								initSnake();
							}
							if (scriptUrl.includes('gameInvitations.js')) {
								initGameInvitations();
							}
							if (scriptUrl.includes('cubeAnimation.js')){
								initCubeAnimation();
							}
						}, scriptUrl.includes('sphere-animation.js') || scriptUrl.includes('snake.js') || scriptUrl.includes('cubeAnimation.js'));
					}
					updateAuthButtons();
				});

				attachFooterButtonEvents();
				if (addToHistory) {
					history.pushState({ url: url }, '', url);
				}
			});	
	}
	attachFooterButtonEvents();

	function initCubeAnimation() {
		console.log('Initializing cube animation...');
		if (window.cubeAnimation) {
			console.log('Cleaning up old cube animation...');
			window.cubeAnimation.cleanup();
		}
		const container = document.getElementById('cube-container');
		if (!container) {
			console.error('Cube container not found!');
			return;
		}
		window.cubeAnimation = new CubeAnimation(container);
	}

	function initGameInvitations() {
		console.log('Initializing game invitations...');
		if (window.gameInvitationsManager) {
			window.gameInvitationsManager.init();
		} else {
			console.error('Game invitations manager not found');
			// If for some reason it's not available, let's create it
			window.gameInvitationsManager = new GameInvitationsManager();
			window.gameInvitationsManager.init();
		}
	}

	function initPong() {
		if (window.pongGame) {
			window.pongGame.stopGame();
			window.pongGame = new PongGame();
		} else {
			window.pongGame = new PongGame();
		}
	}

	function initBot() {
		if (window.PongBot) {
			window.PongBot.stopGame();
			window.PongBot = new PongBot();
		} else {
			window.PongBot = new PongBot();
		}
	}

	function initPongServer() {
		if (window.pongServerGame) {
			console.log('[DYNAMIC]: Cleaning up existing game instance.');
			window.pongServerGame.stopGame();
			window.pongServerGame.cleanup();
			window.pongServerGame = null;
		}
		console.log('[DYNAMIC]: Creating new game instance.');
		window.pongServerGame = new PongServerGame();
	}

	function initPongTournament() {
		if (window.tournament) {
			window.tournament.stopGame();
			window.tournament = new TournamentClient();
		} else {
			window.tournament = new TournamentClient();
		}
	}

	function  initPongAnimation(){
		console.log('Initializing pong animation...');
		// Nettoyage de l'ancienne instance d'animation si elle existe
		if (window.pongAnimation) {
			console.log('Cleaning up old pong animation...');
			window.pongAnimation.stopAnimation();
			window.pongAnimation = null;
		}
		
		// Vérifier que le conteneur existe avant de créer une nouvelle instance
		if (document.querySelector('.pong-container')) {
			console.log('Creating new pong animation instance...');
			window.pongAnimation = new window.PongAnimation();
		} else {
			console.error('Pong container not found!');
		}
	}

	function initSphereAnimation() {
		console.log('Initializing sphere animation...');
		if (window.sphereAnimation) {
			console.log('Cleaning up old animation...');
			window.sphereAnimation.cleanup();
		}
		const container = document.getElementById('sphere-container');
		if (!container) {
			console.error('Sphere container not found!');
			return;
		}
		window.sphereAnimation = new SphereAnimation(container);
	}

	function initSnake() {
		console.log('Initializing snake game...');
		if (window.snakeGame) {
			console.log('Cleaning up old snake game...');
			window.snakeGame.cleanup();
			window.snakeGame = null;
		}
		try {
			window.snakeGame = new Snake3D();
			console.log('Snake game initialized successfully.');
		} catch (error) {
			console.error('Error initializing snake game:', error);
		}
	}

	function cleanupScriptsAndEvents() {
		console.log("[CLEANUP]: Starting cleanup process...");

		// 0. CLeanup Snake
		if (window.snakeGame) {
			console.log("[CLEANUP]: Cleaning up Snake3D...");
			try {
				window.snakeGame.cleanup();
				window.snakeGame = null;
			} catch (error) {
				console.error("[CLEANUP]: Error during Snake3D cleanup:", error);
			}
		}

		// 1. Declare Pong Forfeit
		if (typeof window.declarePongForfeit === 'function') {
			console.log("[CLEANUP]: Declaring Pong forfeit...");
			window.declarePongForfeit();
		}

		// 2. Cancel Pending Invitations
		if (typeof window.cancelPendingPongInvitations === 'function') {
			console.log("[CLEANUP]: Cancelling pending invitations...");
			window.cancelPendingPongInvitations();
		}

		// 3. Cleanup PongServerGame
		if (window.pongServerGame) {
			console.log("[CLEANUP]: Cleaning up PongServerGame...");
			try {
				window.pongServerGame.cleanup();
				window.pongServerGame = null;
			} catch (error) {
				console.error("[CLEANUP]: Error during PongServerGame cleanup:", error);
			}
		}

		// 4. Cleanup FriendInviteManager
		if (window.friendInviteManager) {
			console.log("[CLEANUP]: Cleaning up FriendInviteManager...");
			try {
				if (typeof window.friendInviteManager.cleanup === 'function') {
					window.friendInviteManager.cleanup();
				}
				window.friendInviteManager = null;
			} catch (error) {
				console.error("[CLEANUP]: Error during FriendInviteManager cleanup:", error);
			}
		}

		// 5. Declare Forfeit Tournament - Amélioré!
		if (typeof window.declarePongTournamentForfeit === 'function') {
			console.log("[CLEANUP]: Declaring tournament forfeit...");
			window.declarePongTournamentForfeit();
		} else if (window.tournament && window.tournament.socket) {
			// Fallback direct pour marquer la sortie de page
			console.log("[CLEANUP]: Setting tournament page unloading flag");
			window.tournament.isPageUnloading = true;
			
			// Fermer proprement la connexion socket
			if (window.tournament.socket.readyState === WebSocket.OPEN) {
				console.log("[CLEANUP]: Closing tournament WebSocket connection");
				window.tournament.socket.onclose = null; // Enlever le gestionnaire de reconnexion
				window.tournament.socket.close(1000, "Navigation page change");
			}
		}

		// 6. Ensure tournament cleanup complete
		if (window.tournament) {
			try {
				console.log("[CLEANUP]: Cleaning up tournament client");
				window.tournament.stopGame();
				window.tournament = null;
			} catch (error) {
				console.error("[CLEANUP]: Error during tournament cleanup:", error);
			}
		}

		// 7. Reset loaded scripts registry
		console.log("[CLEANUP]: Resetting loaded scripts registry");
		window.loadedScriptURLs = new Set();

		// 8. Remove Dynamic Scripts
		const dynamicScripts = document.querySelectorAll('script[data-dynamic="true"]');
		console.log(`[CLEANUP]: Removing ${dynamicScripts.length} dynamic scripts...`);
		dynamicScripts.forEach(script => {
			script.remove();
		});

		console.log("[CLEANUP]: Cleanup process completed.");
	}

	function loadScript(url, callback, isModule = false) {
			// Create script registry if it doesn't exist
			window.loadedScriptURLs = window.loadedScriptURLs || new Set();

			// Check if the script is already loaded in current page view
			if (window.loadedScriptURLs.has(url)) {
				console.log(`Script already loaded in this page view: ${url}`);
				if (callback) callback(); // Call the callback if provided
				return;
			}

			// Create and load the script
			const script = document.createElement('script');
			script.setAttribute('data-dynamic', 'true');
			script.setAttribute('data-src', url); // Add this attribute to track loaded scripts

			if (isModule) {
				script.type = 'module';
			}

			if (callback) {
				script.onload = function () {
					callback();
				};
			}

			// Add to our registry
			window.loadedScriptURLs.add(url);

			script.src = url;
			document.body.appendChild(script);
	}

	document.querySelectorAll('.nav-button').forEach(function (button) {
		// Remove existing event listeners to prevent duplication
		button.removeEventListener('click', handleNavButtonClick);
		button.addEventListener('click', handleNavButtonClick);
	});

	function handleNavButtonClick(event) {
		event.preventDefault();

		const url = event.currentTarget.getAttribute('data-url');

		if (window.location.pathname === new URL(url, window.location.origin).pathname) {
			return;
		}

		window.loadContent(url);
	}

	// Ensure popstate listener is added only once
	if (!window.hasPopstateListener) {
		window.addEventListener('popstate', function (event) {
			if (event.state && event.state.url) {
				window.loadContent(event.state.url, false);
			}
		});
		window.hasPopstateListener = true;
	}
});
