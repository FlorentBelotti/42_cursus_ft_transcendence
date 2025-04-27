class GameInvitationsManager {

    /**
     * ╔══════════════════════════════════════════════════════════╗
     * ║               GameInvitationsManager                     ║
     * ╠══════════════════════════════════════════════════════════╣
     * ║ Real-time game invitation management system              ║
     * ║                                                          ║
     * ║ • Handles authentication verification                    ║
     * ║ • Polls for new game invitations from the server         ║
     * ║ • Manages invitation display and user interaction        ║
     * ║ • Processes invitation responses (accept/decline)        ║
     * ║ • Tracks invitation state across page navigation         ║
     * ║ • Provides cross-tab synchronization for invitations     ║
     * ╚══════════════════════════════════════════════════════════╝
     */

    //==========================================================//
    //                   INITIALIZATION                         //
    //==========================================================//

    constructor() {
        this.invitationsContainer = document.getElementById('game-invitations-container');
        this.pollingInterval = null;
        this.lastFetchTime = 0;
        this.activeInvitationIds = new Set();
        this.isInitialized = false;
        this.isAuthenticated = false;
    }

    init() {
        if (this.isInitialized) return;

        console.log("Initializing game invitations manager");

        // Is Friend's modal container available ?
        this.invitationsContainer = document.getElementById('game-invitations-container');
        if (!this.invitationsContainer) {
            console.error("Invitations container not found");
            return;
        }

        // Check authentication before any polling
        this.checkAuthenticationStatus().then(isAuthenticated => {
            if (isAuthenticated) {
                this.isInitialized = true;
                this.isAuthenticated = true;
                this.fetchInvitationsWithForce();
                this.pollingInterval = setInterval(() => {
                    if (Date.now() % 30000 < 1500) {
                        this.checkAuthenticationStatus();
                    }
                    if (this.isAuthenticated) {
                        this.fetchInvitations();
                    }
                }, 1500);

                // Friend's modal management
                document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
                window.addEventListener('storage', this.handleStorageEvent.bind(this));

            } else {
                console.log("User not authenticated - skipping game invitations initialization");
                if (this.invitationsContainer) {
                    this.invitationsContainer.innerHTML = `
                        <p>Connectez-vous pour voir vos invitations</p>
                    `;
                }
            }
        }).catch(error => {
            console.error("Error checking authentication status:", error);
        });
    }

    //==========================================================//
    //                  AUTHENTICATION                          //
    //==========================================================//

    async checkAuthenticationStatus() {
        try {
            const response = await fetch('/api/users/me/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                this.isAuthenticated = false;
                return false;
            }

            const data = await response.json();
            if (data.user) {
                window.currentUser = data.user;
                this.isAuthenticated = true;
                return true;
            }

            this.isAuthenticated = data.status === 'success';
            return this.isAuthenticated;
        } catch (error) {
            console.error('Error checking authentication:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    //==========================================================//
    //                  UI RENDERING                            //
    //==========================================================//

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log("Page became visible - checking for invitation updates");
            this.fetchInvitationsWithForce();
        }
    }

    handleStorageEvent(event) {
        if (event.key && event.key.startsWith('invitation_cancelled_')) {
            console.log("Invitation cancellation detected via localStorage");
            this.fetchInvitationsWithForce();
        }
    }

    showStatusNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.textContent = message;

        if (this.invitationsContainer) {
            this.invitationsContainer.prepend(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }

    displayInvitations(invitations) {
		if (!this.invitationsContainer) return;

		if (!invitations || invitations.length === 0) {
			this.invitationsContainer.innerHTML = ``;
			return;
		}

		let html = `<div class="invitations-list">`;

		invitations.forEach(invitation => {
			const minutes = Math.floor(invitation.time_remaining / 60);
			const seconds = invitation.time_remaining % 60;
			const currentUser = window.currentUser || {}; //

			html += `
				<div class="invitation-container">
					<div class="invitation-card" data-id="${invitation.id}">
						<div class="invitation-header">${invitation.match_type_display}</div>
						<div class="invitation-timer">
							<p class="text-sm text-gray-500">Expire dans ${minutes}m ${seconds}s</p>
						</div>
						<div class="invitation-players">
							<div class="player-card">
								${invitation.sender_profile_pic ?
									`<img src="${invitation.sender_profile_pic}" alt="${invitation.sender_display}" class="player-avatar">` :
									`<div class="player-avatar default-avatar">${invitation.sender_display.charAt(0).toUpperCase()}</div>`
								}
								<div class="player-name">${invitation.sender_display}</div>
								<div class="player-elo">ELO: ${invitation.sender_elo || 'N/A'}</div>
							</div>

							<div class="vs-separator">VS</div>

							<div class="player-card">
								${currentUser.profile_picture ?
									`<img src="${currentUser.profile_picture}" alt="${currentUser.username}" class="player-avatar">` :
									`<div class="player-avatar default-avatar">${currentUser.username?.charAt(0).toUpperCase() || 'Moi'}</div>`
								}
								<div class="player-name">${currentUser.username || 'Moi'}</div>
								<div class="player-elo">ELO: ${currentUser.elo || 'N/A'}</div>
							</div>
						</div>



						<div class="invitation-actions">
							<button class="accept-btn" data-id="${invitation.id}">
								Accepter
							</button>
							<button class="decline-btn" data-id="${invitation.id}">
								Refuser
							</button>
						</div>
					</div>
				</div>
			`;
		});

		html += `</div>`;
		this.invitationsContainer.innerHTML = html;

		// Add event listeners
		document.querySelectorAll('.accept-btn').forEach(btn => {
			btn.addEventListener('click', () => this.respondToInvitation(btn.dataset.id, 'accept'));
		});

		document.querySelectorAll('.decline-btn').forEach(btn => {
			btn.addEventListener('click', () => this.respondToInvitation(btn.dataset.id, 'decline'));
		});
	}

    //==========================================================//
    //                  CLASS DESTRUCTION                       //
    //==========================================================//

    cleanup() {
        console.log("Cleaning up game invitations manager");
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('storage', this.handleStorageEvent);

        this.isInitialized = false;
    }


    //==========================================================//
    //                 DATA FETCHING                            //
    //==========================================================//

    fetchInvitations() {
        if (!this.invitationsContainer) return;

        const now = Date.now();
        if (now - this.lastFetchTime < 1000) {
            return;
        }
        this.lastFetchTime = now;

        fetch('/api/invitations/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': document.querySelector("[name=csrfmiddlewaretoken]")?.value || '',
                'Cache-Control': 'no-cache'
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.redirected) {
                return Promise.reject('Not authenticated');
            }
            return response.json();
        })
        .then(data => {
            this.processInvitationUpdates(data.invitations || []);
        })
        .catch(error => {
            if (error === 'Not authenticated') {
                return;
            }
            console.error('Error fetching invitations:', error);
        });
    }

    fetchInvitationsWithForce() {
        console.log("🔄 Fetching invitations with forced refresh");
        const cacheBuster = `?_=${new Date().getTime()}`;

        // Log the current known invitation IDs for debugging
        console.log("Current active invitations before refresh:", [...this.activeInvitationIds]);

        // Use more aggressive cache prevention
        fetch(`/api/invitations/${cacheBuster}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': document.querySelector("[name=csrfmiddlewaretoken]")?.value || '',
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '-1'
            },
            credentials: 'include'
        })
        .then(response => {
            if (response.redirected) {
                this.invitationsContainer.innerHTML = `
                    <p class="text-amber-500">Vous devez être connecté pour voir les invitations.</p>
                `;
                return Promise.reject('Not authenticated');
            }
            return response.json();
        })
        .then(data => {
            console.log("Invitation data received:", data.invitations ? data.invitations.length : 0, "invitations");

            if (data.invitations && data.invitations.length > 0) {
                console.log("Received invitation IDs:", data.invitations.map(inv => inv.id));
            }

            this.processInvitationUpdates(data.invitations || []);
        })
        .catch(error => {
            if (error === 'Not authenticated') {
                return;
            }
            console.error('Error fetching invitations:', error);
        });
    }

    processInvitationUpdates(newInvitations) {
        // Get current invitations
        const currentIds = new Set(newInvitations.map(inv => inv.id));

        // Check for cancellations
        const cancelledInvitations = [...this.activeInvitationIds].filter(id => !currentIds.has(id));

        if (cancelledInvitations.length > 0) {
            console.log("Found cancelled invitations:", cancelledInvitations);
            this.showStatusNotification("Une invitation a été annulée");
        }

        // Update active invitations
        this.activeInvitationIds = currentIds;

        // Display all current invitations
        this.displayInvitations(newInvitations);
    }

    respondToInvitation(invitationId, action) {
        const card = document.querySelector(`.invitation-card[data-id="${invitationId}"]`);
        if (card) {
            card.querySelector('.accept-btn').disabled = true;
            card.querySelector('.decline-btn').disabled = true;
            card.classList.add('processing');
        }

        fetch(`/api/invitations/${invitationId}/respond/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': document.querySelector("[name=csrfmiddlewaretoken]")?.value || ''
            },
            credentials: 'include',
            body: JSON.stringify({ action })
        })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
                return { success: true, redirected: true };
            }
            return response.json();
        })
        .then(data => {
            if (data.redirected) return;

            if (data.success) {
                if (action === 'accept') {
                    console.log("Invitation accepted, starting game...");
                    this.startInvitedGame(data.game_id, data.sender_username);
                } else {
                    console.log("Invitation declined");
                    // Just refresh the invitations list
                    this.fetchInvitationsWithForce();
                }
            } else {
                alert(`Error: ${data.message}`);
                this.fetchInvitationsWithForce();
            }
        })
        .catch(error => {
            console.error('Error responding to invitation:', error);
            if (card) {
                card.classList.remove('processing');
                card.querySelector('.accept-btn').disabled = false;
                card.querySelector('.decline-btn').disabled = false;
            }
        });
    }

    startInvitedGame(gameId, opponentUsername) {
        console.log(`Starting invited game ${gameId} with ${opponentUsername}`);

        const invitedGameEvent = new CustomEvent('invitedGame', {
            detail: { gameId, opponentUsername }
        });

        if (window.loadContent) {
            sessionStorage.setItem('pendingGame', JSON.stringify({
                gameId,
                opponentUsername,
                timestamp: Date.now()
            }));

            window.loadContent('/match/');

            setTimeout(() => {
                if (window.pongServerGame) {
                    window.pongServerGame.joinInvitedGame(gameId, opponentUsername, false);
                    console.log("Successfully initiated game join");
                } else {
                    console.error("Pong game not initialized!");
                    setTimeout(() => {
                        if (window.pongServerGame) {
                            window.pongServerGame.joinInvitedGame(gameId, opponentUsername, false);
                            console.log("Successfully initiated game join on second attempt");
                        } else {
                            alert("Error initializing game - please refresh the page");
                        }
                    }, 1000);
                }
            }, 500);
        } else {
            console.error("SPA loadContent not available");
            window.location.href = `/match/?game=${gameId}&opponent=${opponentUsername}`;
        }
    }
}

window.gameInvitationsManager = window.gameInvitationsManager || new GameInvitationsManager();

// document.addEventListener('DOMContentLoaded', function() {
//     if (!window.isDynamicLoading) {
//         window.gameInvitationsManager.init();
//     }
// });
