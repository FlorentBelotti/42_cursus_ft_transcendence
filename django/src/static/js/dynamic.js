/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Dynamic Content Loader                 ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side dynamic content management system            ║
 * ║                                                          ║
 * ║ • Handles SPA navigation and content loading             ║
 * ║ • Manages script loading and initialization              ║
 * ║ • Cleans up resources before navigation                  ║
 * ║ • Supports footer and navigation button interactions     ║
 * ║ • Integrates with browser history for navigation         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

document.addEventListener('DOMContentLoaded', function () {
	let pongGame = null;
	let pongServerGame = null;
	let snakeGame = null;
	updateAuthButtons();

	//==========================================================//
	//                   EVENT HANDLING                        //
	//==========================================================//

	function attachFooterButtonEvents() {
		document.querySelectorAll('.footer-button').forEach(function (button) {
			button.removeEventListener('click', handleFooterButtonClick);
			button.addEventListener('click', handleFooterButtonClick);
		});
	}

	function handleFooterButtonClick(event) {
		event.preventDefault();
		const url = event.currentTarget.getAttribute('data-url');
		if (window.location.pathname !== new URL(url, window.location.origin).pathname) {
			window.loadContent(url);
		}
	}

	//==========================================================//
	//                   CONTENT LOADING                       //
	//==========================================================//

	window.loadContent = function(url, addToHistory = true) {
		// Éviter les appels multiples à loadContent pour la même URL
		// Utiliser une variable statique pour suivre l'URL en cours de chargement
		if (window.currentlyLoadingUrl === url) {
			console.log(`[DYNAMIC]:Already loading ${url}, ignoring duplicate request`);
			return;
		}

		// Si une autre navigation est en cours, attendez qu'elle se termine
		if (window.isDynamicLoading) {
			console.log(`[DYNAMIC]:Navigation already in progress, ignoring request to ${url}`);
			return;
		}

		window.isDynamicLoading = true;
		window.currentlyLoadingUrl = url;

		console.log(`[DYNAMIC]:Navigation initiated to ${url}`);
		console.log("[DYNAMIC]:Starting cleanup before navigation");
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

				// Réinitialiser les drapeaux une fois le chargement terminé
				window.isDynamicLoading = false;
				window.currentlyLoadingUrl = null;
			})
			.catch(error => {
				console.error(`[DYNAMIC]:Error loading content from ${url}:`, error);
				// Réinitialiser les drapeaux même en cas d'erreur
				window.isDynamicLoading = false;
				window.currentlyLoadingUrl = null;
			});
	}
	attachFooterButtonEvents();

	//==========================================================//
	//                   GAME INITIALIZATION                   //
	//==========================================================//

	function initCubeAnimation() {
		console.log('[DYNAMIC]:Initializing cube animation...');
		if (window.cubeAnimation) {
			console.log('[DYNAMIC]:Cleaning up old cube animation...');
			window.cubeAnimation.cleanup();
		}
		const container = document.getElementById('cube-container');
		if (!container) {
			console.error('[DYNAMIC]:Cube container not found!');
			return;
		}
		window.cubeAnimation = new CubeAnimation(container);
	}

	function initGameInvitations() {
		console.log('[DYNAMIC]:Initializing game invitations...');
		if (window.gameInvitationsManager) {
			window.gameInvitationsManager.init();
		} else {
			console.error('[DYNAMIC]:Game invitations manager not found');
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
			console.log('[DYNAMIC]:Cleaning up existing game instance.');
			window.pongServerGame.stopGame();
			window.pongServerGame.cleanup();
			window.pongServerGame = null;
		}
		console.log('[DYNAMIC]:Creating new game instance.');
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

	function initPongAnimation(){
		if (window.PongAnimation){
			window.PongAnimation.stopAnimation();
			window.PongAnimation = new PongAnimation();
		} else {
			window.PongAnimation = new PongAnimation();
		}
	}

	function initSphereAnimation() {
		console.log('[DYNAMIC]:Initializing sphere animation...');
		if (window.sphereAnimation) {
			console.log('[DYNAMIC]:Cleaning up old animation...');
			window.sphereAnimation.cleanup();
		}
		const container = document.getElementById('sphere-container');
		if (!container) {
			console.error('[DYNAMIC]:Sphere container not found!');
			return;
		}
		window.sphereAnimation = new SphereAnimation(container);
	}

	function initSnake() {
		console.log('[DYNAMIC]:Initializing snake game...');
		if (window.snakeGame) {
			console.log('[DYNAMIC]:Cleaning up old snake game...');
			window.snakeGame.cleanup();
			window.snakeGame = null;
		}
		try {
			window.snakeGame = new Snake3D();
			console.log('[DYNAMIC]:Snake game initialized successfully.');
		} catch (error) {
			console.error('[DYNAMIC]:Error initializing snake game:', error);
		}
	}

	//==========================================================//
	//                   CLEANUP MANAGEMENT                    //
	//==========================================================//

	function cleanupScriptsAndEvents() {
		console.log("[DYNAMIC]:Starting cleanup process...");

		if (window.snakeGame) {
			console.log("[DYNAMIC]:Cleaning up Snake3D...");
			try {
				window.snakeGame.cleanup();
				window.snakeGame = null;
			} catch (error) {
				console.error("[DYNAMIC]:Error during Snake3D cleanup:", error);
			}
		}

		if (typeof window.declarePongForfeit === 'function') {
			console.log("[DYNAMIC]:Declaring Pong forfeit...");
			window.declarePongForfeit();
		}

		if (typeof window.cancelPendingPongInvitations === 'function') {
			console.log("[DYNAMIC]:Cancelling pending invitations...");
			window.cancelPendingPongInvitations();
		}

		if (window.pongServerGame) {
			console.log("[DYNAMIC]:Cleaning up PongServerGame...");
			try {
				window.pongServerGame.cleanup();
				window.pongServerGame = null;
			} catch (error) {
				console.error("[DYNAMIC]:Error during PongServerGame cleanup:", error);
			}
		}

		if (window.friendInviteManager) {
			console.log("[DYNAMIC]:Cleaning up FriendInviteManager...");
			try {
				if (typeof window.friendInviteManager.cleanup === 'function') {
					window.friendInviteManager.cleanup();
				}
				window.friendInviteManager = null;
			} catch (error) {
				console.error("[DYNAMIC]:Error during FriendInviteManager cleanup:", error);
			}
		}

		if (typeof window.declarePongTournamentForfeit === 'function') {
			console.log("[DYNAMIC]:Declaring tournament forfeit...");
			window.declarePongTournamentForfeit();
		} else if (window.tournament && window.tournament.socket) {
			console.log("[DYNAMIC]:Setting tournament page unloading flag");
			window.tournament.isPageUnloading = true;

			if (window.tournament.socket.readyState === WebSocket.OPEN) {
				console.log("[DYNAMIC]:Closing tournament WebSocket connection");
				window.tournament.socket.onclose = null;
				window.tournament.socket.close(1000, "Navigation page change");
			}
		}

		if (window.tournament) {
			try {
				console.log("[DYNAMIC]:Cleaning up tournament client");
				window.tournament.stopGame();
				window.tournament = null;
			} catch (error) {
				console.error("[DYNAMIC]:Error during tournament cleanup:", error);
			}
		}

		console.log("[DYNAMIC]:Resetting loaded scripts registry");
		window.loadedScriptURLs = new Set();

		const dynamicScripts = document.querySelectorAll('script[data-dynamic="true"]');
		console.log(`[DYNAMIC]:Removing ${dynamicScripts.length} dynamic scripts...`);
		dynamicScripts.forEach(script => {
			script.remove();
		});

		console.log("[DYNAMIC]:Cleanup process completed.");
	}

	//==========================================================//
	//                   SCRIPT LOADING                        //
	//==========================================================//

	function loadScript(url, callback, isModule = false) {
		window.loadedScriptURLs = window.loadedScriptURLs || new Set();

		if (window.loadedScriptURLs.has(url)) {
			console.log(`[DYNAMIC]:Script already loaded in this page view: ${url}`);
			if (callback) callback();
			return;
		}

		const script = document.createElement('script');
		script.setAttribute('data-dynamic', 'true');
		script.setAttribute('data-src', url);

		if (isModule) {
			script.type = 'module';
		}

		if (callback) {
			script.onload = function () {
				callback();
			};
		}

		window.loadedScriptURLs.add(url);

		script.src = url;
		document.body.appendChild(script);
	}

	//==========================================================//
	//                   NAVIGATION HANDLING                    //
	//==========================================================//

	document.querySelectorAll('.nav-button').forEach(function (button) {
		button.addEventListener('click', function (event) {
			event.preventDefault();

			const url = button.getAttribute('data-url');

			if (window.location.pathname === new URL(url, window.location.origin).pathname) {
				return;
			}

			window.loadContent(url);
		});
	});

	window.addEventListener('popstate', function (event) {
		if (event.state && event.state.url) {
			window.loadContent(event.state.url, false);
		}
	});
});