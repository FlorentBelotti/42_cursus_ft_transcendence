function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

document.getElementById('authentication').addEventListener('submit', function(event) {
    event.preventDefault();

    const token = getCookie('access_token');

        fetch('/api/send-verification-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                "email": userInfo.email
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Bad Request');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Verification successful');
            } else {
                console.error('Error:', data);
                document.getElementById('errorMessage').textContent = 'Verification failed';
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            document.getElementById('errorMessage').textContent = 'An error occurred';
    })
    .catch((error) => {
        console.error('Error:', error);
        document.getElementById('errorMessage').textContent = 'Failed to fetch user info';
    });
});