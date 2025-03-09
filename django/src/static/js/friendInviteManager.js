class FriendInviteManager {
    constructor(options = {}) {
        this.dialogId = 'friendsInviteDialog';
        this.onInviteSent = options.onInviteSent || (() => console.log('Friend invited (default handler)'));
        this.customTitle = options.title || 'Invite Friends';
        this.socket = options.socket || null;
        this.onDialogClosed = options.onDialogClosed || (() => {});
    }

    showDialog() {
        // Check if there's an existing dialog element
        let dialog = document.getElementById(this.dialogId);
        
        // If not, create one
        if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = this.dialogId;
            dialog.className = 'friends-invite-dialog';
            
            // Add content to the dialog
            dialog.innerHTML = `
                <h3 style="margin-bottom: 15px; font-size: 18px; font-weight: bold;">${this.customTitle}</h3>
                <p style="margin-bottom: 10px;">Select friends to invite:</p>
                <div id="friendsList" style="max-height: 300px; overflow-y: auto;">
                    <p>Loading friends list...</p>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button id="cancelInviteBtn" style="margin-right: 10px; padding: 8px 12px; border: 1px solid #ccc; background: #f0f0f0; border-radius: 4px;">Cancel</button>
                    <button id="sendInvitesBtn" style="padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 4px;">Send Invites</button>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // Add event listeners for the dialog buttons
            document.getElementById('cancelInviteBtn').addEventListener('click', () => {
                dialog.remove();
                this.onDialogClosed();
            });
            
            document.getElementById('sendInvitesBtn').addEventListener('click', () => {
                this.finishInvites();
                dialog.remove();
                this.onDialogClosed();
            });
            
            // Fetch connected friends list
            this.fetchConnectedFriends();
        }
    }

    fetchConnectedFriends() {
        console.log('Attempting to fetch online friends');
        const friendsList = document.getElementById('friendsList');
        
        // Show loading indicator
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
            console.log('Online friends response status:', response.status);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Online friends data received:', data);
            
            if (data.online_friends && data.online_friends.length === 0) {
                // Fallback to all friends if no online friends
                this.fetchAllFriends();
            } else {
                this.displayFriendsList(data.online_friends || []);
            }
        })
        .catch(error => {
            console.error('Error fetching friends:', error);
            // If there's an error, try fetching all friends as fallback
            this.fetchAllFriends();
        });
    }
    
    fetchAllFriends() {
        console.log('Fetching all friends as fallback');
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
            
            // Filter to just show our friends
            const currentUsername = typeof currentUser !== 'undefined' ? currentUser.username : null;
            let friends = users.filter(user => {
                // This is a simple placeholder, you'll need to adjust based on your API response
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
            
            // Create a container for the friends list
            const listContainer = document.createElement('div');
            listContainer.className = 'friends-list-container';
            
            // Add header explaining that we're showing all friends
            const header = document.createElement('div');
            header.style.padding = '10px';
            header.style.background = '#f0f0f0';
            header.style.borderBottom = '1px solid #ddd';
            header.style.fontWeight = 'bold';
            header.textContent = 'All Friends (online status may be incorrect)';
            listContainer.appendChild(header);
            
            // Add each friend to the list
            friends.forEach(friend => {
                const friendItem = document.createElement('div');
                friendItem.className = 'friend-item';
                friendItem.style.display = 'flex';
                friendItem.style.alignItems = 'center';
                friendItem.style.padding = '10px';
                friendItem.style.borderBottom = '1px solid #eee';
                
                // Friend profile picture
                let profilePicHtml = '';
                if (friend.profile_picture) {
                    profilePicHtml = `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">`;
                } else {
                    profilePicHtml = `<div class="profile-picture bg-gray-300" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #ccc;"><span>${friend.username.charAt(0).toUpperCase()}</span></div>`;
                }
                
                // Create the inner HTML for the friend item
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
            
            // Add event listeners for invite buttons
            const inviteButtons = friendsList.querySelectorAll('.invite-btn');
            inviteButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const username = e.target.dataset.username;
                    this.inviteFriend(username);
                    e.target.disabled = true;
                    e.target.textContent = 'Invited';
                    e.target.style.backgroundColor = '#888';
                });
            });
        })
        .catch(error => {
            console.error('Error fetching all friends:', error);
            const friendsList = document.getElementById('friendsList');
            friendsList.innerHTML = `<p>Error loading friends list. Please try again later.</p>`;
        });
    }

    displayFriendsList(friendsData) {
        const friendsList = document.getElementById('friendsList');

        // Clear loading message
        friendsList.innerHTML = '';

        // Check if we have friends
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

        // Create a container for the friends list
        const listContainer = document.createElement('div');
        listContainer.className = 'friends-list-container';

        // Add each friend to the list
        friendsData.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.style.display = 'flex';
            friendItem.style.alignItems = 'center';
            friendItem.style.padding = '10px';
            friendItem.style.borderBottom = '1px solid #eee';

            // Friend profile picture
            let profilePicHtml = '';
            if (friend.profile_picture) {
                profilePicHtml = `<img src="${friend.profile_picture}" alt="${friend.username}" class="profile-picture">`;
            } else {
                profilePicHtml = `<div class="profile-picture bg-gray-300" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #ccc;"><span>${friend.username.charAt(0).toUpperCase()}</span></div>`;
            }

            // Create the inner HTML for the friend item
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

        // Add event listeners for invite buttons
        const inviteButtons = friendsList.querySelectorAll('.invite-btn');
        inviteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                this.inviteFriend(username);
                e.target.disabled = true;
                e.target.textContent = 'Invited';
                e.target.style.backgroundColor = '#888';
            });
        });
    }

    inviteFriend(username) {
        console.log(`Inviting friend: ${username}`);

        // Call the callback with the username
        this.onInviteSent(username);
    }

    finishInvites() {
        console.log('All invites sent.');
        // This method can be extended if needed
    }
}