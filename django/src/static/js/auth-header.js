let previousActiveButton = null;

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
                    <li><button type="button" class="pong-button" id="pong-game-button">Games</button></li>
                `;
                const pongModal = document.getElementById('pong-modal');
                const pongGameButton = document.getElementById('pong-game-button');
                if (pongGameButton) {
                    pongGameButton.addEventListener('click', function(event) {
                        event.preventDefault();
                        // Sauvegarder le bouton actif actuel comme précédent
                        previousActiveButton = document.querySelector('.nav-button.active, .pong-button.active, #amis-button.active');
                        document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        this.classList.add('active');
                        updateSlider(this);
                        pongModal.style.display = 'block';
                    });
                }
            }

            authButtonsContainer.innerHTML = `
                <li><button id="amis-button">Friends</button></li>
                <li><button class="nav-button" data-url="${data.urls.leaderboard}">Leaderboard</button></li>
                <li><button class="nav-button" data-url="${data.urls.account}">Account</button></li>
            `;

            const friendsModal = document.getElementById('friends-modal');
            const amisButton = document.getElementById('amis-button');
            if (amisButton) {
                amisButton.addEventListener('click', function () {
                    // Sauvegarder le bouton actif actuel comme précédent
                    previousActiveButton = document.querySelector('.nav-button.active, .pong-button.active, #amis-button.active');
                    document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    this.classList.add('active');
                    updateSlider(this);
                    fetchFriends();
                    friendsModal.style.display = 'block';
                });
            }
        } else {
            authButtonsContainer.innerHTML = `
                <li><button class="nav-button" data-url="${data.urls.register}">Register</button></li>
                <li><button class="nav-button" data-url="${data.urls.login}">Login</button></li>
            `;
        }

        document.querySelectorAll('.nav-button').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                const url = button.getAttribute('data-url');
                document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
                updateSlider(this);
                if (window.location.pathname !== new URL(url, window.location.origin).pathname) {
                    window.loadContent(url);
                    history.pushState({ url: url }, '', url);
                }
            });
        });

        initHeaderSlider();
    } catch (error) {
        console.error('Error updating auth buttons:', error);
    }
}

function updateSlider(activeButton) {
    const slider = document.querySelector('.menu-item-slider');
    if (!activeButton || !slider) return;

    const buttonRect = activeButton.getBoundingClientRect();
    const navRect = activeButton.closest('nav').getBoundingClientRect();

    slider.style.width = `${buttonRect.width}px`;
    slider.style.height = `${buttonRect.height}px`;
    slider.style.left = `${buttonRect.left - navRect.left}px`;
    slider.style.display = 'block';
}

function initHeaderSlider() {
    const navButtons = document.querySelectorAll('.nav-button, .pong-button, #amis-button');
    const slider = document.querySelector('.menu-item-slider');

    if (!navButtons.length || !slider) {
        console.warn('Aucun bouton ou slider trouvé pour initialisation');
        return;
    }

    function initActiveButton() {
        const currentPath = window.location.pathname;
        let activeButton = null;

        navButtons.forEach(button => {
            const buttonUrl = button.getAttribute('data-url');
            if (buttonUrl && currentPath.includes(buttonUrl)) {
                button.classList.add('active');
                activeButton = button;
            }
        });

        if (!activeButton && navButtons.length > 0) {
            navButtons[0].classList.add('active');
            activeButton = navButtons[0];
        }

        return activeButton;
    }

    const activeButton = initActiveButton();
    if (activeButton) {
        updateSlider(activeButton);
    }

    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            updateSlider(this);
        });
    });

    navButtons.forEach(button => {
        button.addEventListener('mouseover', function() {
            updateSlider(this);
        });

        button.addEventListener('mouseout', function() {
            const currentActive = document.querySelector('.nav-button.active, .pong-button.active, #amis-button.active');
            if (currentActive) {
                updateSlider(currentActive);
            }
        });
    });

    window.addEventListener('resize', function() {
        const activeBtn = document.querySelector('.nav-button.active, .pong-button.active, #amis-button.active');
        updateSlider(activeBtn);
    });
}
document.addEventListener('DOMContentLoaded', function () {
    updateAuthButtons();

    const pongModal = document.getElementById('pong-modal');
    const friendsModal = document.getElementById('friends-modal');
    const closePongModal = pongModal.querySelector('.close-modal');
    const closeFriendsModal = friendsModal.querySelector('.close-friends-modal');

    // Fermer la modale Pong et revenir au bouton précédent
    closePongModal.addEventListener('click', function () {
        pongModal.style.display = 'none';
        if (previousActiveButton) {
            document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                btn.classList.remove('active');
            });
            previousActiveButton.classList.add('active');
            updateSlider(previousActiveButton);
        }
    });

    window.addEventListener('click', function (event) {
        if (event.target === pongModal) {
            pongModal.style.display = 'none';
            if (previousActiveButton) {
                document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                    btn.classList.remove('active');
                });
                previousActiveButton.classList.add('active');
                updateSlider(previousActiveButton);
            }
        }
    });

    // Fermer la modale Friends et revenir au bouton précédent
    closeFriendsModal.addEventListener('click', function () {
        friendsModal.style.display = 'none';
        if (previousActiveButton) {
            document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                btn.classList.remove('active');
            });
            previousActiveButton.classList.add('active');
            updateSlider(previousActiveButton);
        }
    });

    window.addEventListener('click', function (event) {
        if (event.target === friendsModal) {
            friendsModal.style.display = 'none';
            if (previousActiveButton) {
                document.querySelectorAll('.nav-button.active, .pong-button.active, #amis-button.active').forEach(btn => {
                    btn.classList.remove('active');
                });
                previousActiveButton.classList.add('active');
                updateSlider(previousActiveButton);
            }
        }
    });
});

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

