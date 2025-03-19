document.addEventListener('DOMContentLoaded', function () {
	let pongGame = null;
	let pongServerGame = null;
	let snakeGame = null;
	updateAuthButtons();

	window.loadContent = function(url, addToHistory = true) {

		window.isDynamicLoading = true;
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
								updateFormEvent();
								passwordFormEvent();
								deleteFormEvent();
								updateAuthButtons();
								disconnectFormEvent();
    							nicknameFormEvent();
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
							if (scriptUrl.includes('cube-animation.js')){
								initCubeAnimation();
							}
						}, scriptUrl.includes('sphere-animation.js') || scriptUrl.includes('snake.js') || scriptUrl.includes('cube-animation.js'));
					}
					updateAuthButtons();
				});

				if (addToHistory) {
					history.pushState({ url: url }, '', url);
				}
			});
	}

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
			window.pongServerGame.stopGame();
			window.pongServerGame = new PongServerGame();
		} else {
			window.pongServerGame = new PongServerGame();
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
		if (window.pongServerGame) {
			console.log("Found pongServerGame, cancelling any pending invitations");
			window.pongServerGame.cancelPendingInvitations();

			if (window.pongServerGame.isGameRunning) {
				console.log("Game is running, stopping game");
				window.pongServerGame.stopGame();
			}
		}

		const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
		dynamicScripts.forEach(script => {
			if (!script.src.includes('pong.js') && !script.src.includes('pongServer.js')) {
				script.remove();
			}
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
		if (window.snakeGame) {
			window.snakeGame.cleanup();
			window.snakeGame = null;
		}
		if (window.cubeAnimation) {
            console.log('Cleaning up cube animation...');
            window.cubeAnimation.cleanup();
            window.cubeAnimation = null;
        }
        if (window.gameInvitationsManager) {
            window.gameInvitationsManager.cleanup();
        }
	}

	function loadScript(url, callback, isModule = false) {
		const existingScript = document.querySelector(`script[src="${url}"]`);
		if (existingScript) {
			if (callback) callback();
			return;
		}

		const script = document.createElement('script');
		script.type = isModule ? 'module' : 'text/javascript';
		script.src = url;
		script.setAttribute('data-dynamic', 'true');

		script.onload = function () {
			if (callback) callback();
		};
		document.head.appendChild(script);
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
