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
				const friendsModal = document.getElementById('friends-modal');
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
						if (friendsModal){
							friendsModal.style.display = 'none';
						}
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
			const pongModal = document.getElementById('pong-modal');
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
					if (pongModal){
						pongModal.style.display = 'none';
					}
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
					// history.pushState({ url: url }, '', url);
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
	const closePongModal = pongModal.querySelector('.close-modal');
	const pongModalButtons = document.querySelectorAll('.modal-button');

	const friendsModal = document.getElementById('friends-modal');
	const closeFriendsModal = friendsModal.querySelector('.close-friends-modal');

	// LISTEN TO CLICK EVENT ON PONG MODAL

	pongModalButtons.forEach(button => {
		button.addEventListener('click', function() {
			const url = button.getAttribute('data-url');
			// OPTIONNAL : handle re-click
			if (url) {
				window.loadContent(url);
				// history.pushState({ url: url }, '', url);
			}
		})
	})

	// CLOSE

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
});

