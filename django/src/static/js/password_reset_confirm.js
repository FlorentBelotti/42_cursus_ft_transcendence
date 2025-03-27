document.getElementById('resetConfirmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const response = await fetch(window.location.pathname, {
        method: 'POST',
        body: formData,
        headers: { 'X-CSRFToken': formData.get('csrfmiddlewaretoken') }
    });
    const data = await response.json();
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'block';
    if (data.success) {
        errorMessage.style.color = 'green';
        errorMessage.textContent = data.success;
        setTimeout(() => {
            window.location.href = data.redirect_url;
        }, 1000);
    } else {
        errorMessage.style.color = 'red';
        errorMessage.textContent = data.error;
    }
});