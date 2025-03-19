document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('friends-modal');
    const openModalBtn = document.querySelector('.friend-button'); // Bouton pour ouvrir la modale
    const closeModal = document.querySelector('.close-friend-modal');
    const friendsContainer = document.querySelector('.friends-container');

    // Ouvrir la modale et charger les amis
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
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
                    modal.style.display = 'block';
                })
                .catch(error => console.error('Erreur lors du chargement des amis:', error));
        });
    } else {
        console.error("Le bouton avec l'ID 'friend-button' n'a pas été trouvé.");
    }

    // Fermer la modale
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Fermer la modale en cliquant à l'extérieur
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});
