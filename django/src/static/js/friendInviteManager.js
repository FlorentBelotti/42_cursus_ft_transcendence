/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Friend Invite Manager                  ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side friend invitation management system          ║
 * ║                                                          ║
 * ║ • Manages friend invitation dialog UI                    ║
 * ║ • Fetches and displays online friends list               ║
 * ║ • Handles invitation sending and status updates          ║
 * ║ • Supports single invitation per session                 ║
 * ║ • Provides cleanup for resource management               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class FriendInviteManager {
	constructor(options = {}) {
		this.dialogId = 'friendsInviteDialog';
		this.onInviteSent = options.onInviteSent || (() => console.log('[FRIEND-INVITE]:Friend invited (default handler)'));
		this.customTitle = options.title || 'Invite Friends';
		this.socket = options.socket || null;
		this.onDialogClosed = options.onDialogClosed || (() => {});
		this.hasInvitedSomeone = false;
	}

	//==========================================================//
	//                   DIALOG MANAGEMENT                     //
	//==========================================================//

	showDialog() {
		this.hasInvitedSomeone = false;

		let dialog = document.getElementById(this.dialogId);

		if (!dialog) {
			dialog = document.createElement('div');
			dialog.id = this.dialogId;
			dialog.className = 'friends-invite-dialog';

			dialog.style.backgroundColor = '#171717';
			dialog.style.color = '#ffffff';
			dialog.style.padding = '20px';
			dialog.style.borderRadius = '8px';
			dialog.style.position = 'fixed';
			dialog.style.top = '50%';
			dialog.style.left = '50%';
			dialog.style.transform = 'translate(-50%, -50%)';
			dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
			dialog.style.zIndex = '1000';

			dialog.innerHTML = `
				<h3 style="margin-bottom: 15px; font-size: 18px; font-weight: bold;">${this.customTitle}</h3>
				<p style="margin-bottom: 10px;">Select friends to invite:</p>
				<div id="friendsList" style="max-height: 300px; overflow-y: auto;">
					<p>Loading friends list...</p>
				</div>
				<div style="margin-top: 20px; text-align: right;">
					<button id="cancelInviteBtn" style="margin-right: 10px; padding: 8px 12px; border: 1px solid #555; background: #333; color: #fff; border-radius: 4px;">Cancel</button>
					<button id="closeDialogBtn" style="padding: 8px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px;">Close</button>
				</div>
				<div id="inviteStatus" style="margin-top: 10px; text-align: center; color: green; display: none;"></div>
			`;

			document.body.appendChild(dialog);

			document.getElementById('cancelInviteBtn').addEventListener('click', () => {
				dialog.remove();
				this.onDialogClosed();
			});

			document.getElementById('closeDialogBtn').addEventListener('click', () => {
				this.finishInvites();
				dialog.remove();
				this.onDialogClosed();
			});

			this.fetchConnectedFriends();
		}
	}

	//==========================================================//
	//                   FRIEND LIST FETCHING                  //
	//==========================================================//

	fetchConnectedFriends() {
		console.log('[FRIEND-INVITE]:Attempting to fetch online friends');
		const friendsList = document.getElementById('friendsList');

		friendsList.innerHTML = '<p>Loading friends list...</p>';

		fetch('/api/online-friends/', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest'
			},
			credentials: 'include'
		})
		.then(response => {
			console.log('[FRIEND-INVITE]:Online friends response status:', response.status);
			if (!response.ok) {
				throw new Error(`Network response was not ok: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			console.log('[FRIEND-INVITE]:Online friends data received:', data);

			if (data.online_friends && data.online_friends.length === 0) {
				friendsList.innerHTML = '<p>No riends online</p>';
			} else {
				this.displayFriendsList(data.online_friends || []);
			}
		})
		.catch(error => {
			console.error('[FRIEND-INVITE]:Error fetching friends:', error);
			friendsList.innerHTML = '<p>No riends online</p>';
		});
	}

	fetchAllFriends() {
		console.log('[FRIEND-INVITE]:Fetching all friends as fallback');
		fetch('/api/users/', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest'
			},
			credentials: 'include'
		})
		.then(response => response.json())
		.then(users => {
			const friendsList = document.getElementById('friendsList');

			const currentUsername = typeof currentUser !== 'undefined' ? currentUser.username : null;
			let friends = users.filter(user => {
				return user.username !== currentUsername;
			});

			if (friends.length === 0) {
				friendsList.innerHTML = `
					<div style="text-align: center; padding: 20px;">
						<p>No friends found.</p>
						<p style="margin-top: 10px; font-size: 14px; color: #666;">
							Add friends to invite them to tournaments.
						</p>
					</div>`;
				return;
			}

			const listContainer = document.createElement('div');
			listContainer.className = 'friends-list-container';

			const header = document.createElement('div');
			header.style.padding = '10px';
			header.style.background = '#f0f0f0';
			header.style.borderBottom = '1px solid #ddd';
			header.style.fontWeight = 'bold';
			header.textContent = 'All Friends (online status may be incorrect)';
			listContainer.appendChild(header);

			friends.forEach(friend => {
				const friendItem = document.createElement('div');
				friendItem.className = 'friend-item';
				friendItem.style.display = 'flex';
				friendItem.style.alignItems = 'center';
				friendItem.style.padding = '10px';
				friendItem.style.borderBottom = '1px solid #444';

				let profilePicHtml = '';
				if (friend.profile_picture) {
					profilePicHtml = `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">`;
				} else {
					profilePicHtml = `<div class="profile-picture bg-gray-300" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #ccc;"><span>${friend.username.charAt(0).toUpperCase()}</span></div>`;
				}

				friendItem.innerHTML = `
					<div style="flex: 0 0 40px; margin-right: 10px;">${profilePicHtml}</div>
					<div style="flex: 1;">${friend.username}</div>
					<div style="flex: 0 0 60px;">
						<button class="invite-btn" data-username="${friend.username}" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Invite</button>
					</div>
				`;

				listContainer.appendChild(friendItem);
			});

			friendsList.innerHTML = '';
			friendsList.appendChild(listContainer);

			const inviteButtons = friendsList.querySelectorAll('.invite-btn');
			inviteButtons.forEach(button => {
				button.addEventListener('click', (e) => {
					if (this.hasInvitedSomeone) {
						return;
					}

					const username = e.target.dataset.username;
					this.inviteFriend(username);

					this.disableAllInviteButtons();

					e.target.textContent = 'Invited';
					e.target.style.backgroundColor = '#888';

					const cancelButton = document.getElementById('cancelInviteBtn');
					if (cancelButton) {
						cancelButton.style.display = 'none';
					}
				});
			});
		})
		.catch(error => {
			console.error('[FRIEND-INVITE]:Error fetching all friends:', error);
			const friendsList = document.getElementById('friendsList');
			friendsList.innerHTML = `<p>Error loading friends list. Please try again later.</p>`;
		});
	}

	//==========================================================//
	//                   CLASS DESTRUCTION                     //
	//==========================================================//

	cleanup() {
		console.log("[FRIEND-INVITE]:Cleaning up resources...");
		this.hasInvitedSomeone = false;
		console.log("[FRIEND-INVITE]:Cleanup completed.");
	}

	//==========================================================//
	//                   FRIEND LIST RENDERING                 //
	//==========================================================//

	displayFriendsList(friendsData) {
		const friendsList = document.getElementById('friendsList');

		friendsList.innerHTML = '';

		if (!friendsData || friendsData.length === 0) {
			friendsList.innerHTML = `
				<div style="text-align: center; padding: 20px;">
					<p>No online friends found.</p>
					<p style="margin-top: 10px; font-size: 14px; color: #666;">
						Your friends need to be online to receive invitations.
					</p>
				</div>`;
			return;
		}

		const listContainer = document.createElement('div');
		listContainer.className = 'friends-list-container';

		friendsData.forEach(friend => {
			const friendItem = document.createElement('div');
			friendItem.className = 'friend-item';
			friendItem.style.display = 'flex';
			friendItem.style.alignItems = 'center';
			friendItem.style.padding = '10px';
			friendItem.style.borderBottom = '1px solid #eee';

			let profilePicHtml = '';
			if (friend.profile_picture) {
				profilePicHtml = `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">`;
			} else {
				profilePicHtml = `<div class="profile-picture bg-gray-300" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #ccc;"><span>${friend.username.charAt(0).toUpperCase()}</span></div>`;
			}

			friendItem.innerHTML = `
				<div style="flex: 0 0 40px; margin-right: 10px;">${profilePicHtml}</div>
				<div style="flex: 1;">${friend.username}</div>
				<div style="flex: 0 0 60px;">
					<button class="invite-btn" data-username="${friend.username}" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Invite</button>
				</div>
			`;

			listContainer.appendChild(friendItem);
		});

		friendsList.appendChild(listContainer);

		const inviteButtons = friendsList.querySelectorAll('.invite-btn');
		inviteButtons.forEach(button => {
			button.addEventListener('click', (e) => {
				if (this.hasInvitedSomeone) {
					return;
				}

				const username = e.target.dataset.username;
				this.inviteFriend(username);

				this.disableAllInviteButtons();

				e.target.textContent = 'Invited';
				e.target.style.backgroundColor = '#888';

				const cancelButton = document.getElementById('cancelInviteBtn');
				if (cancelButton) {
					cancelButton.style.display = 'none';
				}
			});
		});
	}

	//==========================================================//
	//                   INVITATION HANDLING                   //
	//==========================================================//

	inviteFriend(username) {
		console.log(`[FRIEND-INVITE]:Inviting friend: ${username}`);

		this.hasInvitedSomeone = true;

		this.onInviteSent(username);

		this.showInvitationStatus(`Invitation sent to ${username}`);
	}

	disableAllInviteButtons() {
		const inviteButtons = document.querySelectorAll('.invite-btn');
		inviteButtons.forEach(button => {
			if (button.textContent !== 'Invited') {
				button.disabled = true;
				button.style.opacity = '0.5';
				button.style.backgroundColor = '#cccccc';
				button.style.cursor = 'not-allowed';
			}
		});
	}

	updateSendInvitesButton() {
		const sendInvitesBtn = document.getElementById('sendInvitesBtn');
		if (sendInvitesBtn) {
			sendInvitesBtn.textContent = 'Close';
			sendInvitesBtn.style.backgroundColor = '#e74c3c';
			sendInvitesBtn.style.borderColor = '#c0392b';
		}

		const cancelButton = document.getElementById('cancelInviteBtn');
		if (cancelButton) {
			cancelButton.style.display = 'none';
		}
	}

	showInvitationStatus(message) {
		const statusElement = document.getElementById('inviteStatus');
		if (statusElement) {
			statusElement.textContent = message;
			statusElement.style.display = 'block';

			statusElement.style.backgroundColor = '#d4edda';
			statusElement.style.color = '#155724';
			statusElement.style.padding = '10px';
			statusElement.style.borderRadius = '4px';
			statusElement.style.marginTop = '15px';
		}
	}

	finishInvites() {
		console.log('[FRIEND-INVITE]:Dialog closed.');
	}
}