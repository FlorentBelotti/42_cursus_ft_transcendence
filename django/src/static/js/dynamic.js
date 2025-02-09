document.addEventListener('DOMContentLoaded', function() {

    function loadContent(url, addToHistory = true) {
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
                    loadScript(scriptUrl, function() {
                        // if (scriptUrl.includes('pongServer.js')) {
                        //     initWebSocket();
                        // }
                        if (scriptUrl.includes('leaderboard.js')) {
                            loadLeaderboard();
                        }
                        if (scriptUrl.includes('account.js')) {
                            initAccountPage();
                        }
                        if (scriptUrl.includes('modal.js')) {
                            initModal(); // Réinitialiser les écouteurs d'événements du modal
                        }
                    });
                }
            });
    
            if (addToHistory) {
                history.pushState({ url: url }, '', url);
            }
        });
    }

    function cleanupScriptsAndEvents() {
        // Supprimer tous les scripts dynamiques
        const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
        dynamicScripts.forEach(script => script.remove());
    
        // Supprimer tous les écouteurs d'événements (exemple pour le modal)
        const openModalButton = document.getElementById('openModalButton');
        const closeModalButton = document.querySelector('.close');
        const matchmakingButton = document.getElementById('matchmaking');
    
        if (openModalButton) {
            openModalButton.replaceWith(openModalButton.cloneNode(true)); // Cloner pour supprimer les événements
        }
        if (closeModalButton) {
            closeModalButton.replaceWith(closeModalButton.cloneNode(true)); // Cloner pour supprimer les événements
        }
        if (matchmakingButton) {
            matchmakingButton.replaceWith(matchmakingButton.cloneNode(true)); // Cloner pour supprimer les événements
        }
    }

    // Function to load a script dynamically
    function loadScript(url, callback) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.setAttribute('data-dynamic', 'true'); // Marquer le script comme dynamique
    
        script.onload = function() {
            if (callback) {
                callback();
            }
        };
        document.head.appendChild(script);
    }

    // Select all links on the page
    document.querySelectorAll('.nav-button').forEach(function(button) {

        button.addEventListener('click', function(event) {
            event.preventDefault();

            const url = button.getAttribute('data-url');

            if (window.location.pathname === new URL(url, window.location.origin).pathname) {
                return;
            }

            loadContent(url);
            history.pushState({ url: url }, '', url); 
        });
    });

    // Handle the browser's back and forward buttons
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.url) {
            loadContent(event.state.url, false);
        }
    });
});