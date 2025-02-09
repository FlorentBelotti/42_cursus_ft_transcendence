const modal = document.getElementById('myModal');
const openModalButton = document.getElementById('openModalButton');
const closeModalButton = document.querySelector('.close');
const matchmakingButton = document.getElementById('matchmaking');
const statusText = document.getElementById('status');

function initModal() {
    const modal = document.getElementById('myModal');
    const openModalButton = document.getElementById('openModalButton');
    const closeModalButton = document.querySelector('.close');
    const matchmakingButton = document.getElementById('matchmaking');
    const statusText = document.getElementById('status');

    if (!modal || !openModalButton || !closeModalButton || !matchmakingButton || !statusText) {
        console.error('Modal elements not found');
        return;
    }

    // Ouvrir la modale lorsque l'utilisateur clique sur le bouton
    openModalButton.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    // Fermer la modale lorsque l'utilisateur clique sur le bouton de fermeture (×)
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Fermer la modale lorsque l'utilisateur clique en dehors de la modale
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Lancer la recherche de partie
    matchmakingButton.addEventListener('click', () => {
        statusText.textContent = "Recherche de partie...";
        matchmakingButton.disabled = true; // Désactiver le bouton pendant la recherche

        // Simuler une recherche de partie (ex: appel à un serveur)
        setTimeout(() => {
            statusText.textContent = "Partie trouvée ! 🎮";
            matchmakingButton.textContent = "Rejoindre";
            matchmakingButton.disabled = false;

            // Ici, tu peux ajouter une redirection ou un appel API pour rejoindre la partie
        }, 3000);
    });
}

// Initialiser le modal après le chargement de la page
document.addEventListener('DOMContentLoaded', initModal);