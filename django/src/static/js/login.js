function loginFormEvent() {
    document.getElementById("loginForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let loginFormData = new FormData(event.target);
        let response = await fetch('/login/', {
            method: "post",
            body: loginFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        });
        let data = await response.json();
        if ('success' in data) {
            console.log('Success:', "Redirecting to double authentication");
            localStorage.setItem('user_id', data.user_id);
            // Afficher la modale au lieu de charger une page
            document.getElementById('verifyModal').style.display = 'block';
        } else if ('error' in data) {
            console.log('Error:', "Wrong username or password");
            const errorDiv = document.getElementById("errorMessage");
            errorDiv.textContent = data.error;
            errorDiv.style.display = "block";
            setTimeout(() => {
                errorDiv.style.display = "none";
            }, 3000); 
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    loginFormEvent();
});
