class GameInvitationsManager {
    constructor() {
        this.invitationsContainer = document.getElementById('game-invitations-container');
        this.pollingInterval = null;
    }

    init() {
        this.invitationsContainer = document.getElementById('game-invitations-container');
        if (!this.invitationsContainer) {
            console.error('Game invitations container not found');
            return;
        }
        
        this.fetchInvitations();
        
        // Set up polling every 30 seconds
        this.pollingInterval = setInterval(() => this.fetchInvitations(), 30000);
        
        // Make sure there's a CSRF token
        if (!document.querySelector("[name=csrfmiddlewaretoken]")) {
            const csrfToken = '{% csrf_token %}';
            this.invitationsContainer.insertAdjacentHTML('beforebegin', csrfToken);
        }
    }
    
    cleanup() {
        // Clear the polling interval when navigating away
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    fetchInvitations() {
        if (!this.invitationsContainer) return;
        
        fetch('/api/invitations/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': document.querySelector("[name=csrfmiddlewaretoken]")?.value || ''
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
            this.displayInvitations(data.invitations || []);
        })
        .catch(error => {
            if (error === 'Not authenticated') {
                return;
            }
            console.error('Error fetching invitations:', error);
            if (this.invitationsContainer) {
                this.invitationsContainer.innerHTML = `
                    <div class="text-red-500">
                        Erreur lors du chargement des invitations. Veuillez actualiser la page.
                    </div>
                `;
            }
        });
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
            const buttons = card.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50');
            });
            
            card.querySelector('.invitation-actions').innerHTML += `
                <span class="text-sm text-gray-500">Traitement en cours...</span>
            `;
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
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                if (action === 'accept' && data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    if (card) {
                        card.style.transition = 'opacity 0.5s, transform 0.5s';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(100px)';
                        setTimeout(() => {
                            card.remove();
                            
                            if (document.querySelectorAll('.invitation-card').length === 0 && this.invitationsContainer) {
                                this.invitationsContainer.innerHTML = `
                                    <p class="text-gray-500">Aucune invitation de jeu en attente.</p>
                                `;
                            }
                        }, 500);
                    }
                }
            } else {
                alert(data.message || 'Erreur lors de la réponse à l\'invitation');
                this.fetchInvitations(); // Refresh the list
            }
        })
        .catch(error => {
            console.error('Error responding to invitation:', error);
            alert('Erreur lors de la réponse à l\'invitation. Veuillez réessayer.');
            this.fetchInvitations(); // Refresh the list
        });
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