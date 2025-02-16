async function updateAuthButtons() {
    try {
        const response = await fetch('/api/auth-status/', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const data = await response.json();
        
        const authButtonsContainer = document.getElementById('auth-buttons');
        
        if (data.is_authenticated) {
            authButtonsContainer.innerHTML = `
                <button class="nav-button" data-url="${data.urls.account}">Account</button>
            `;
        } else {
            authButtonsContainer.innerHTML = `
                <button class="nav-button" data-url="${data.urls.register}">Register</button>
                <button class="nav-button" data-url="${data.urls.login}">Login</button>
            `;
        }
        
        document.querySelectorAll('.nav-button').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                const url = button.getAttribute('data-url');
                if (window.location.pathname === new URL(url, window.location.origin).pathname) {
                    return;
                }
                window.loadContent(url);
                history.pushState({ url: url }, '', url);
            });
        });
    } catch (error) {
        console.error('Error updating auth buttons:', error);
    }
}