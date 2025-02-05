document.addEventListener('DOMContentLoaded', function() {
    
    // Function to load content dynamically
    function loadContent(url, addToHistory = true) {
        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.text()) // Convert response to HTML text
        .then(html => {
            // Insert the content into the base.html dynamic content (id: content)
            document.getElementById('content').innerHTML = html;

            // Add the URL to the browser history
            if (addToHistory) {
                history.pushState({ url: url }, '', url);
            }
        });
    }
    
    // Select all links on the page
    document.querySelectorAll('a').forEach(function(link) {

        // Add event "click" on each link
        link.addEventListener('click', function(event) {

            // Prevent the default navigation behavior of the link
            event.preventDefault();

            // Check if the current URL is the same as the link's URL
            if (window.location.pathname === new URL(link.href).pathname) {
                return; // Do nothing if the URLs are the same
            }

            // Fetch the content of the link
            loadContent(link.href);
        });
    });
    
    // Handle the browser's back and forward buttons
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.url) {
            loadContent(event.state.url, false);
        }
    });
});