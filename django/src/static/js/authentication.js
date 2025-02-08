document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('authenticationForm').addEventListener('submit', function(event) {
        event.preventDefault();

        const code = document.getElementById('verificationCode').value;
        const email = userEmail; // Utiliser la variable de contexte pour l'email
        console.log('email:', email);
        
        fetch('/api/verify-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "code": code,
                "email": email
            })
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
            console.log('Verification successful');
            fetch('/api/token-ranked/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "code": code
                })
            })
            // Rediriger vers une autre page ou effectuer une autre action
            window.location.href = '/home/';
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Invalid verification code. Please try again.');
        });
    });
});