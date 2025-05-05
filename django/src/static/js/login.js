/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Login Manager                          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side login form management system                 ║
 * ║                                                          ║
 * ║ • Handles login form submission                          ║
 * ║ • Manages authentication responses                       ║
 * ║ • Triggers two-factor authentication modal               ║
 * ║ • Displays error messages with timeout                   ║
 * ║ • Handles OAuth authentication errors                    ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   FORM HANDLING                          //
//==========================================================//

document.addEventListener('DOMContentLoaded', function() {
    // Gestion du formulaire de connexion
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Vérifier si un message d'erreur est présent dans l'URL (redirigé depuis auth/error/)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
        const error = urlParams.get('error');
        displayError(decodeURIComponent(error));
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(loginForm);
            
            fetch('/login/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (data.require_verification) {
                        showVerificationModal(data.user_id);
                    } else {
                        window.location.href = data.redirect_url;
                    }
                } else {
                    displayError(data.error);
                }
            })
            .catch(error => {
                displayError("Une erreur s'est produite. Veuillez réessayer.");
                console.error('Error:', error);
            });
        });
    }
    
    // Fonction pour afficher les erreurs
    function displayError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }
    
    // Redirection vers OAuth 42
    const oauth42Button = document.querySelector('.social-img');
    if (oauth42Button) {
        oauth42Button.addEventListener('click', function(e) {
            e.preventDefault();
            const oauth42Url = this.parentElement.getAttribute('href');
            
            // Vérifier que l'API 42 est accessible avant de rediriger
            fetch('https://api.intra.42.fr/oauth/token/info', {
                method: 'HEAD',
                mode: 'no-cors' // Pas d'accès CORS, on vérifie juste la disponibilité
            })
            .then(() => {
                // Redirection vers l'authentification 42
                window.location.href = oauth42Url;
            })
            .catch(error => {
                displayError("Le service d'authentification 42 semble indisponible. Veuillez utiliser la connexion classique ou réessayer plus tard.");
                console.error('API 42 error:', error);
            });
        });
    }
    
    // Fonction pour afficher le modal de vérification
    function showVerificationModal(userId) {
        const verifyModal = document.getElementById('verifyModal');
        if (verifyModal) {
            verifyModal.style.display = 'block';
            
            // Mettre à jour le formulaire avec l'ID utilisateur
            const verifyForm = document.getElementById('verifyCodeForm');
            verifyForm.setAttribute('data-user-id', userId);
        }
    }
});