/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Friend Modal Manager                   ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side friend management system                     ║
 * ║                                                          ║
 * ║ • Fetches and displays friends list                      ║
 * ║ • Handles adding new friends                             ║
 * ║ • Manages friend status UI updates                       ║
 * ║ • Provides error handling and feedback messages          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   FRIEND LIST FETCHING                   //
//==========================================================//

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
		console.error('[FRIEND-MODAL]:Erreur:', error);
		const friendsList = document.getElementById('friends-list');
		friendsList.innerHTML = `<p>Erreur: ${error.message}</p>`;
	});
}

//==========================================================//
//                   FRIEND ADDING                         //
//==========================================================//

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
		console.log('[FRIEND-MODAL]:Ami ajouté avec succès:', data);
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
		console.error('[FRIEND-MODAL]:Erreur:', error);
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

//==========================================================//
//                   EVENT HANDLING                         //
//==========================================================//

const addFriendButton = document.getElementById('add-friend-button');
const friendUsernameInput = document.getElementById('friend-username');

if (addFriendButton && friendUsernameInput) {
	addFriendButton.addEventListener('click', function () {
		const username = friendUsernameInput.value.trim();
		if (username) {
			addFriend(username);
			friendUsernameInput.value = '';
		}
	});
}