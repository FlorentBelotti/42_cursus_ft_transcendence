function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

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
            // const token = getCookie('access_token');
            // console.log('Token from cookie:', token);
            // Envoyer une requête à /api/send-verification-code/ avec le token et l'email
            return fetch('/api/send-verification-code/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // 'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    "email": email
                })
            });
        } else {
            console.error('Error:', data);
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || 'Bad Request');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Verification code sent successfully');
        // Rediriger vers l'URL /authentication/
        window.location.href = '/authentication/';
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Invalid email or password. Please try again.');
    });
});