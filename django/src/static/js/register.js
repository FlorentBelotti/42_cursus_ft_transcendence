document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    fetch('/api/users/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "username": username,
            "password": password,
            "email": email,
            "elo": 1000
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Bad Request');
        }
        return response.json();
    })
    // .then(data => {
    //     console.log('Success:', data);
    // })
    .catch((error) => {
        console.error('Error:', error);
    });
});