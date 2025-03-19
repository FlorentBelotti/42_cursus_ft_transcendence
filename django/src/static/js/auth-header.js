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

        if (gameButtonsContainer) {
            gameButtonsContainer.innerHTML = '';
        }

        if (data.is_authenticated) {
            if (gameButtonsContainer) {
                gameButtonsContainer.innerHTML = `
                    <button type="button" class="pong-button" id="pong-game-button">Games</button>
                `;
                const pongModal = document.getElementById('pong-modal');
                const pongGameButton = document.getElementById('pong-game-button');
                if (pongGameButton) {
                    pongGameButton.addEventListener('click', function(event) {
                        event.preventDefault();
                        pongModal.style.display = 'block';
                    });
                }
            }

            authButtonsContainer.innerHTML = `
                <button class="nav-button" data-url="${data.urls.leaderboard}">Stats</button>
                <button class="nav-button" data-url="${data.urls.friends}">Friends</button>
                <button type="button" class="friend-button" id="friend-button">Friends Test</button>
                <button class="nav-button" data-url="${data.urls.account}">Account</button>
            `;

            // Ajout de la logique pour la modale des amis
            const friendModal = document.getElementById('friends-modal');
            const friendButton = document.getElementById('friend-button');
            const closeModal = document.querySelector('.close-friend-modal');
            const friendsContainer = document.querySelector('.friends-container');

            if (friendButton) {
                friendButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    fetch('/users/api/friends/')
                        .then(response => response.json())
                        .then(data => {
                            friendsContainer.innerHTML = '';
                            data.friends.forEach(friend => {
                                const profilePicture = friend.profile_picture ?
                                    `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">` :
                                    `<div class="profile-picture"><span>${friend.username[0].toUpperCase()}</span></div>`;
                                const statusClass = friend.is_online ? 'green' : 'gray';
                                const statusText = friend.is_online ? 'connected' : 'disconnected';
								console.log('Réponse de l’API:', data);
                                friendsContainer.innerHTML += `
                                    <div class="friends-list-item">
                                        <div class="profile-picture-container">
                                            ${profilePicture}
                                            <span class="status-dot ${statusClass}"></span>
                                        </div>
                                        <div class="friends-info">
                                            <span class="friends-username">${friend.username}</span>
                                            <span class="friends-state ${statusText}">${statusText}</span>
                                        </div>
                                    </div>`;
                            });
                            friendModal.style.display = 'block';
                        })
                        .catch(error => console.error('Erreur lors du chargement des amis:', error));
                });
            }

            if (closeModal) {
                closeModal.addEventListener('click', function() {
                    friendModal.style.display = 'none';
                });
            }

            window.addEventListener('click', function(event) {
                if (event.target === friendModal) {
                    friendModal.style.display = 'none';
                }
            });

        } else {
            authButtonsContainer.innerHTML = `
                <button class="nav-button" data-url="${data.urls.register}">Register</button>
                <button class="nav-button" data-url="${data.urls.login}">Login</button>
            `;
        }

        document.querySelectorAll('.nav-button').forEach(function(button) {
            button.addEventListener('click', function(event) {
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
