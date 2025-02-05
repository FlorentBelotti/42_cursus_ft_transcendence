document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(event) {
            loadContent(event, this.href);
        });
    });
});

function loadContent(event, url) {
    event.preventDefault();
    fetch(url, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.text())
    .then(html => {
        document.getElementById('content').innerHTML = html;
        window.history.pushState({}, '', url);
    })
    .catch(error => console.error('Error loading content:', error));
}