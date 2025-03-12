class GameInvitationsManager {
    constructor() {
        this.invitationsContainer = document.getElementById('game-invitations-container');
        this.pollingInterval = null;
        this.lastFetchTime = 0;
        this.activeInvitationIds = new Set(); // Track active invitation IDs
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        this.invitationsContainer = document.getElementById('game-invitations-container');
        if (!this.invitationsContainer) {
            console.error("Invitations container not found");
            return;
        }
        
        console.log("Initializing game invitations manager");
        this.isInitialized = true;
        
        // Immediate initial fetch
        this.fetchInvitationsWithForce();
        
        // Set up aggressive polling (every 1.5 seconds)
        this.pollingInterval = setInterval(() => this.fetchInvitations(), 1500);
        
        // Add visibility change listener to refresh when tab becomes active
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Add storage event listener for cross-tab cancellation notifications
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
    
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
        // Show a temporary notification message
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.textContent = message;
        
        // Add to DOM and remove after 3 seconds
        if (this.invitationsContainer) {
            this.invitationsContainer.prepend(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }
    
    cleanup() {
        console.log("Cleaning up game invitations manager");
        // Clear the polling interval when navigating away
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('storage', this.handleStorageEvent);
        
        this.isInitialized = false;
    }

    // Regular polling fetch (less aggressive caching)
    fetchInvitations() {
        if (!this.invitationsContainer) return;
        
        // Track the last fetch time (to prevent too frequent refreshes)
        const now = Date.now();
        if (now - this.lastFetchTime < 1000) {
            // Don't fetch more than once per second
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
            
            // Log the IDs of the received invitations
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
        
        // Check for cancellations (invitations that disappeared)
        const cancelledInvitations = [...this.activeInvitationIds].filter(id => !currentIds.has(id));
        
        if (cancelledInvitations.length > 0) {
            console.log("Found cancelled invitations:", cancelledInvitations);
            this.showStatusNotification("Une invitation a été annulée");
        }
        
        // Update active invitations tracking
        this.activeInvitationIds = currentIds;
        
        // Display all current invitations
        this.displayInvitations(newInvitations);
    }

    displayInvitations(invitations) {
        if (!this.invitationsContainer) return;
        
        if (!invitations || invitations.length === 0) {
            this.invitationsContainer.innerHTML = `
                <p class="text-gray-500">Aucune invitation de jeu en attente.</p>
            `;
            return;
        }
        
        let html = `<div class="space-y-4">`;
        
        invitations.forEach(invitation => {
            const minutes = Math.floor(invitation.time_remaining / 60);
            const seconds = invitation.time_remaining % 60;
            
            html += `
                <div class="invitation-card bg-gray-50 border rounded-md p-3 flex justify-between items-center" data-id="${invitation.id}">
                    <div class="flex items-center">
                        <div class="invitation-avatar mr-3">
                            ${invitation.sender_profile_pic ? 
                                `<img src="${invitation.sender_profile_pic}" alt="${invitation.sender_display}" class="w-10 h-10 rounded-full object-cover">` :
                                `<div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                    ${invitation.sender_display.charAt(0).toUpperCase()}
                                </div>`
                            }
                        </div>
                        <div>
                            <p class="font-medium">${invitation.sender_display} vous a invité à un ${invitation.match_type_display}</p>
                            <p class="text-sm text-gray-500">Expire dans ${minutes}m ${seconds}s</p>
                        </div>
                    </div>
                    <div class="invitation-actions space-x-2">
                        <button class="accept-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
                                data-id="${invitation.id}">
                            Accepter
                        </button>
                        <button class="decline-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
                                data-id="${invitation.id}">
                            Refuser
                        </button>
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
        
        // Create a custom event for invited game
        const invitedGameEvent = new CustomEvent('invitedGame', {
            detail: { gameId, opponentUsername }
        });
        
        // Use SPA navigation to match page
        if (window.loadContent) {
            // Save the game data to sessionStorage to retrieve after navigation
            sessionStorage.setItem('pendingGame', JSON.stringify({
                gameId,
                opponentUsername,
                timestamp: Date.now()
            }));
            
            window.loadContent('/match/');
            
            // Set a small delay to ensure the page loads before connecting
            setTimeout(() => {
                // The match page should have loaded pongServer.js which creates pongServerGame
                if (window.pongServerGame) {
                    window.pongServerGame.joinInvitedGame(gameId, opponentUsername, false);
                    console.log("Successfully initiated game join");
                } else {
                    console.error("Pong game not initialized!");
                    // Try again with a longer delay as a fallback
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
            // Fallback to direct navigation with parameters
            window.location.href = `/match/?game=${gameId}&opponent=${opponentUsername}`;
        }
    }
}

// Create a global instance for dynamic.js to access
window.gameInvitationsManager = window.gameInvitationsManager || new GameInvitationsManager();

// Initialize when loaded directly (for backwards compatibility)
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if not being loaded by dynamic.js
    if (!window.isDynamicLoading) {
        window.gameInvitationsManager.init();
    }
});