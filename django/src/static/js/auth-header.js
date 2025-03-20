async function updateAuthButtons() {
    try {
        const response = await fetch('/api/auth-status/', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const data = await response.json();

        const authButtonsContainer = document.getElementById('auth-buttons');
        const gameButtonsContainer = document.getElementById('game-buttons');

        // Clear game buttons container
        if (gameButtonsContainer) {
            gameButtonsContainer.innerHTML = '';
        }

        if (data.is_authenticated) {
            // Add game buttons for authenticated users only
            if (gameButtonsContainer) {
                gameButtonsContainer.innerHTML = `
                    <button type="button" class="pong-button" id="pong-game-button">Pong</button>
                `;

                // Set up pong button modal functionality
                const pongModal = document.getElementById('pong-modal');
                const pongGameButton = document.getElementById('pong-game-button');
                if (pongGameButton) {
                    pongGameButton.addEventListener('click', function (event) {
                        event.preventDefault();
                        pongModal.style.display = 'block';
                    });
                }
            }

            // Add auth buttons for logged-in users
            authButtonsContainer.innerHTML = `
            <button class="nav-button" data-url="${data.urls.leaderboard}">Stats</button>
            <button class="nav-button" data-url="${data.urls.friends}">Friends</button>
            <button class="nav-button" data-url="${data.urls.account}">Account</button>
            `;
        } else {
            // No game buttons for non-authenticated users

            // Show login/register buttons
            authButtonsContainer.innerHTML = `
                <button class="nav-button" data-url="${data.urls.register}">Register</button>
                <button class="nav-button" data-url="${data.urls.login}">Login</button>
            `;
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
    } catch (error) {
        console.error('Error updating auth buttons:', error);
    }
}
