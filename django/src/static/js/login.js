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
    // Éléments DOM
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Gestion des messages d'erreur de l'URL
    function checkForUrlErrors() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('error')) {
            const error = urlParams.get('error');
            displayError(decodeURIComponent(error));
            
            // Nettoyer l'URL après affichage de l'erreur
            const newUrl = window.location.pathname;
            history.pushState({}, document.title, newUrl);
        }
    }
    
    // Vérifier les erreurs dans l'URL au chargement
    checkForUrlErrors();
    
    // Fonction pour afficher les messages d'erreur
    function displayError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            
            // Animation pour attirer l'attention
            errorMessage.classList.add('shake-error');
            setTimeout(() => {
                errorMessage.classList.remove('shake-error');
            }, 500);
        }
    }
    
    // Gestion du formulaire de login
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
    
    // Redirection vers OAuth 42 avec vérification préalable
    const oauth42Button = document.querySelector('.social-img');
    if (oauth42Button) {
        oauth42Button.addEventListener('click', function(e) {
            e.preventDefault();
            const oauth42Url = this.parentElement.getAttribute('href');
            
            // Désactiver temporairement le bouton pour éviter les clics multiples
            this.style.opacity = '0.6';
            this.style.pointerEvents = 'none';
            
            // Essai de ping pour vérifier si l'API 42 est accessible
            const checkApi = async () => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch('https://api.intra.42.fr/', {
                        method: 'HEAD',
                        mode: 'no-cors',
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // Si on arrive ici, l'API est probablement accessible
                    window.location.href = oauth42Url;
                } catch (error) {
                    // Réactiver le bouton
                    this.style.opacity = '1';
                    this.style.pointerEvents = 'auto';
                    
                    // Afficher l'erreur
                    displayError("Le service d'authentification 42 semble indisponible. Veuillez utiliser la connexion classique ou réessayer plus tard.");
                    console.error('API 42 error:', error);
                }
            };
            
            // Exécuter la vérification
            checkApi();
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
    
    // Ajouter un style CSS pour l'animation d'erreur
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-5px); }
            40%, 80% { transform: translateX(5px); }
        }
        .shake-error {
            animation: shake 0.5s ease-in-out;
            background-color: rgba(255, 0, 0, 0.1);
            border-radius: 4px;
            padding: 10px;
            transition: background-color 0.3s ease;
        }
    `;
    document.head.appendChild(style);
});