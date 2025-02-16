document.addEventListener('DOMContentLoaded', function () {
    let pongGame = null; // Variable pour stocker l'instance du jeu Pong
    let pongServerGame = null; // Variable pour stocker l'instance du jeu Pong Server

    window.loadContent = function(url, addToHistory = true) {
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
                            if (scriptUrl.includes('account.js')) {
                                initAccountPage();
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
                        });
                    }
                });

                if (addToHistory) {
                    history.pushState({ url: url }, '', url);
                }
            });
    }

    function initPong() {
        if (window.pongGame) {
            // Réinitialiser l'instance existante
            window.pongGame.stopGame();
            window.pongGame = new PongGame();
        } else {
            // Créer une nouvelle instance
            window.pongGame = new PongGame();
        }
    }

    function initPongServer() {
        if (window.pongServerGame) {
            // Réinitialiser l'instance existante
            window.pongServerGame.stopGame();
            window.pongServerGame = new PongServerGame();
        } else {
            // Créer une nouvelle instance
            window.pongServerGame = new PongServerGame();
        }
    }

    function cleanupScriptsAndEvents() {
        // Supprimer tous les scripts dynamiques
        const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
        dynamicScripts.forEach(script => {
            // Ne pas supprimer le script pong.js ou pongServer.js s'ils sont déjà chargés
            if (!script.src.includes('pong.js') && !script.src.includes('pongServer.js')) {
                script.remove();
            }
        });

        // Arrêter le jeu Pong s'il est en cours
        if (window.pongGame && window.pongGame.isGameRunning) {
            window.pongGame.stopGame();
        }

        // Arrêter le jeu Pong Server s'il est en cours
        if (window.pongServerGame && window.pongServerGame.isGameRunning) {
            window.pongServerGame.stopGame();
        }
    }

    // Function to load a script dynamically
    function loadScript(url, callback) {
        // Vérifier si le script est déjà chargé
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript) {
            if (callback) callback();
            return;
        }

        // Charger le script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.setAttribute('data-dynamic', 'true');

        script.onload = function () {
            if (callback) callback();
            // if (url.includes('pongServer.js')) {
            //     initPongServer(); // Initialiser le jeu Pong Server
            // }
        };
        document.head.appendChild(script);
    }

    // Select all links on the page
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

    // Handle the browser's back and forward buttons
    window.addEventListener('popstate', function (event) {
        if (event.state && event.state.url) {
            window.loadContent(event.state.url, false);
        }
    });
});