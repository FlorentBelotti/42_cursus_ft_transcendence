function loadContent(page, event) {
    if (event) {
        event.preventDefault(); // Empêche le comportement par défaut du lien
    }
    history.pushState(null, '', `/${page}/`); // Met à jour l'URL sans recharger la page
    fetch(`/${page}/`)
        .then(response => response.text())
        .then(html => {
            document.getElementById('content').innerHTML = html;
        })
        .catch(error => {
            console.error('Erreur lors du chargement du contenu:', error);
        });
}

// Charger le contenu initial
document.addEventListener('DOMContentLoaded', function() {
    loadContent('home', new Event('load'));
});