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
							if (scriptUrl.includes('pong.js')) {
								initPong();
							}
							if (scriptUrl.includes('pongServer.js')) {
								initPongServer();
							}
							if (scriptUrl.includes('tournamentClient.js')) {
								initPongTournament();
							}
							if (scriptUrl.includes('leaderboard.js')) {
								loadLeaderboard();
							}
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
							if (scriptUrl.includes('leaderboard.js')) {
								loadLeaderboardPage();
							}
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
		if (window.PongAnimation){
			window.PongAnimation.stopAnimation();
			window.PongAnimation = new PongAnimation();
		}else{
			window.PongAnimation = new PongAnimation();
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
		window.snakeGame = new Snake3D();
	}

	function cleanupScriptsAndEvents() {

		if (typeof window.declarePongForfeit === 'function') {
			console.log("[DYNAMIC]: Calling global forfeit declaration");
			window.declarePongForfeit();
		}

		if (typeof window.cancelPendingPongInvitations === 'function') {
			console.log("[DYNAMIC]: Calling global invitation cancellation");
			window.cancelPendingPongInvitations();
		}

		if (typeof window.declarePongTournamentForfeit === 'function') {
			console.log("[DYNAMIC]: Calling global forfeit declaration");
			window.declarePongTournamentForfeit();
		}

		if (window.pongServerGame && window.pongServerGame.socket) {
			try {
				console.log("Forcing socket close during cleanup");
				if (window.pongServerGame.socket.readyState === WebSocket.OPEN) {
					window.pongServerGame.socket.send(JSON.stringify({
						type: 'declare_forfeit'
					}));
					window.pongServerGame.socket.onclose = null;
					window.pongServerGame.socket.close(1000, "Navigation cleanup");
				}
			} catch (e) {
				console.error("Error closing socket:", e);
			}
		}

		if (window.pongServerGame) {
			console.log("Cleaning up pongServerGame");
			try {
				// Make sure the socket is closed
				if (window.pongServerGame.socket &&
					window.pongServerGame.socket.readyState === WebSocket.OPEN) {
					console.log("Closing socket connection");
					window.pongServerGame.socket.close();
				}

				// Set flags to prevent further activity
				window.pongServerGame.isPageUnloading = true;
			} catch (error) {
				console.error("Error during pongServerGame cleanup:", error);
			}
		}

		if (window.friendInviteManager) {
			console.log("Cleaning up friendInviteManager");
			try {
				window.friendInviteManager = null;
			} catch (error) {
				console.error("Error during friendInviteManager cleanup:", error);
			}
		}
	
		// Clean up gameInvitationsManager
		// if (window.gameInvitationsManager) {
		// 	console.log("Cleaning up gameInvitationsManager");
		// 	try {
		// 		window.gameInvitationsManager.cleanup();
		// 	} catch (error) {
		// 		console.error("Error during gameInvitationsManager cleanup:", error);
		// 	}
		// }

		// Remove global instances to prevent conflicts on reload
		window.pongServerGame = null;
		window.pongGame = null;

		// Remove dynamic scripts
		const dynamicScripts = document.querySelectorAll('script[data-dynamic="true"]');
		console.log(`Removing ${dynamicScripts.length} dynamic scripts`);
		dynamicScripts.forEach(script => {
			script.remove();
		});

		if (window.pongGame && window.pongGame.isGameRunning) {
			window.pongGame.stopGame();
		}
		if (window.pongServerGame && window.pongServerGame.isGameRunning) {
			window.pongServerGame.stopGame();
		}
		if (window.snakeGame){
			window.snakeGame.cleanup();
			window.snakeGame = null;
		}
		if (window.sphereAnimation) {
			window.sphereAnimation.cleanup();
			window.sphereAnimation = null;
		}
		// if (window.gameInvitationsManager) {
		// 	window.gameInvitationsManager.cleanup();
		// }

		if (window.cubeAnimation) {
			console.log('Cleaning up cube animation...');
			window.cubeAnimation.cleanup();
			window.cubeAnimation = null;
		}

		if (window.PongAnimation) {
			console.log("Cleaning up Pong animation...");
			window.PongAnimation.stopAnimation();
			window.PongAnimation = null;
		}
	}

	function loadScript(url, callback, isModule = false) {
		// Check if script is already loaded (by data-src attribute)
		const existingScript = document.querySelector(`script[data-src="${url}"]`);
		if (existingScript) {
			console.log(`Script already loaded: ${url}`);
			if (callback) callback();
			return;
		}

		const script = document.createElement('script');
		script.setAttribute('data-dynamic', 'true');
		script.setAttribute('data-src', url);  // Add this attribute to check for duplicates

		if (isModule) {
			script.type = 'module';
		}

		if (callback) {
			script.onload = function() {
				callback();
			};
		}

		script.src = url;
		document.body.appendChild(script);
	}

	document.querySelectorAll('.nav-button').forEach(function (button) {
		button.addEventListener('click', function (event) {
			event.preventDefault();

			const url = button.getAttribute('data-url');

			if (window.location.pathname === new URL(url, window.location.origin).pathname) {
				return;
			}

			window.loadContent(url);
			history.pushState({ url: url }, '', url);
		});
	});

	window.addEventListener('popstate', function (event) {
		if (event.state && event.state.url) {
			window.loadContent(event.state.url, false);
		}
	});
});
