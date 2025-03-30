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
                    <li><button type="button" class="pong-button" id="pong-game-button">Pong</button></li>
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
            <li><button id="amis-button">Friends</button></li>
            <li><button class="nav-button" data-url="${data.urls.leaderboard}">Leaderboard</button></li>
            <li><button class="nav-button" data-url="${data.urls.account}">Account</button></li>
            `;

            // Set up friends modal functionality
            const friendsModal = document.getElementById('friends-modal');
            const amisButton = document.getElementById('amis-button');

            if (amisButton) {
                amisButton.addEventListener('click', function () {
                    fetchFriends();
                    friendsModal.style.display = 'block';
                });
            }
        } else {
            // Show login/register buttons for non-authenticated users
            authButtonsContainer.innerHTML = `
                <li><button class="nav-button" data-url="${data.urls.register}">Register</button></li>
                <li><button class="nav-button" data-url="${data.urls.login}">Login</button></li>
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

    // Fetch Friends function
	function fetchFriends() {
		fetch('/api/friends/', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		})
		.then(response => {
			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Non authentifié - veuillez vous reconnecter');
				}
				throw new Error('Erreur lors du chargement des amis');
			}
			return response.json();
		})
		.then(data => {
			const friendsList = document.getElementById('friends-list');
			if (data.friends && data.friends.length > 0) {
				friendsList.innerHTML = data.friends.map(friend => `
					<div class="friend-item">
						<div class="friend-avatar-container">
							${friend.profile_picture ?
								`<img src="${friend.profile_picture}" alt="${friend.username}" class="friend-avatar">` :
								`<div class="friend-avatar default-avatar">${(friend.nickname || friend.username).charAt(0).toUpperCase()}</div>`
							}
							<div class="status-indicator ${friend.is_online ? 'status-online' : 'status-offline'}"></div>
						</div>
						<div class="friend-info">
							<div class="friend-name">${friend.nickname || friend.username}</div>
							<div class="friend-status">${friend.is_online ? 'En ligne' : 'Hors ligne'}</div>
						</div>
					</div>
				`).join('');
			} else {
				friendsList.innerHTML = '<p>Vous n\'avez pas encore d\'amis</p>';
			}
		})
		.catch(error => {
			console.error('Erreur:', error);
			const friendsList = document.getElementById('friends-list');
			friendsList.innerHTML = `<p>Erreur: ${error.message}</p>`;
		});
	}

    // Add Friend function
    function addFriend(username) {
		const addFriendMessage = document.getElementById('add-friend-message');
    	addFriendMessage.innerHTML = '';

        fetch('/api/friends/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: username })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Non authentifié - veuillez vous reconnecter');
                }
                if (response.status === 404) {
                    throw new Error('Utilisateur non trouvé');
                }
                if (response.status === 400) {
                    throw new Error('Cet utilisateur est déjà votre ami ou vous ne pouvez pas vous ajouter vous-même');
                }
                throw new Error('Erreur lors de l\'ajout de l\'ami');
            }
            return response.json();
        })
		.then(data => {
			console.log('Ami ajouté avec succès:', data);
			addFriendMessage.innerHTML = '<span style="color: green;">Ami ajouté avec succès !</span>';
			setTimeout(() => {
				addFriendMessage.classList.add('fade-out');
				setTimeout(() => {
					addFriendMessage.innerHTML = '';
					addFriendMessage.classList.remove('fade-out');
					fetchFriends();
				}, 300);
			}, 2000);
		})
		.catch(error => {
			console.error('Erreur:', error);
			addFriendMessage.innerHTML = `<span style="color: red;">${error.message}</span>`;
			setTimeout(() => {
				addFriendMessage.classList.add('fade-out');
				setTimeout(() => {
					addFriendMessage.innerHTML = '';
					addFriendMessage.classList.remove('fade-out');
					fetchFriends();
				}, 300);
			}, 2000);
		});
    }

    // Add event listener for adding friends
    const addFriendButton = document.getElementById('add-friend-button');
    const friendUsernameInput = document.getElementById('friend-username');

    if (addFriendButton && friendUsernameInput) {
        addFriendButton.addEventListener('click', function () {
            const username = friendUsernameInput.value.trim();
            if (username) {
                addFriend(username);
                friendUsernameInput.value = ''; // Réinitialiser l'input
            }
        });
    }

    // Close modal functionality
    const friendsModal = document.getElementById('friends-modal');
    const closeFriendsModal = document.querySelector('.close-friends-modal');

    if (closeFriendsModal) {
        closeFriendsModal.addEventListener('click', function () {
            friendsModal.style.display = 'none';
        });
    }

    window.addEventListener('click', function (event) {
        if (event.target === friendsModal) {
            friendsModal.style.display = 'none';
        }
    });
}
