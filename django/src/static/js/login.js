document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    fetch('/api/token/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "email": email,
            "password": password
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(data.detail || 'Bad Request');
        }
        return response.json();
    })
    .then(data => {
        if (data.access) {
            console.log('Token stored successfully in cookie');
            // Envoyer une requête à /api/send-verification-code/ avec le token et l'email
            return fetch('/api/send-verification-code/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.access}`
                },
                body: JSON.stringify({
                    "email": email
                })
            });
        } else {
            console.error('Error:', data);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Invalid email or password. Please try again.');
    });
});