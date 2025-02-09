document.addEventListener('DOMContentLoaded', function() {

    // Function to load content dynamically
    function loadContent(url, addToHistory = true) {
        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.text()) // Convert response to HTML text
        .then(html => {
            // Insert the content into the base.html dynamic content (id: content)
            document.getElementById('content').innerHTML = html;

            // Load all scripts found in the content
            const scripts = document.querySelectorAll('#content script');
            scripts.forEach(script => {
                const scriptUrl = script.src;
                if (scriptUrl) {
                    loadScript(scriptUrl, function() {
                        if (document.getElementById('pong')) {
                            initWebSocket();
                        }
                        if (scriptUrl.includes('leaderboard.js')) {
                            loadLeaderboard();
                        }
                    });
                }
            });

            // Add the URL to the browser history
            if (addToHistory) {
                history.pushState({ url: url }, '', url);
            }
        });
    }

    // Function to load a script dynamically
    function loadScript(url, callback) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

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