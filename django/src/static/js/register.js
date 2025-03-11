function registerFormEvent() {
    document.getElementById("registerForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let registerFormData = new FormData(event.target);
        
        let response = await fetch('/register/', {
            method: "post",
            body: registerFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        });
        let data = await response.json();

        document.querySelectorAll('.error').forEach(el => el.textContent = '');

        if ('success' in data) {
            console.log('Success:', "User created");
            window.loadContent('/home/');
        } else if ('error' in data) {
            console.log('Error:', data.error);
            const errorDiv = document.getElementById("errorMessage");
            errorDiv.textContent = '';
            
            if (data.error.includes('nom d’utilisateur')) {
                document.getElementById('username-error').textContent = data.error;
            } else if (data.error.includes('email')) {
                document.getElementById('email-error').textContent = data.error;
            } else if (data.error.includes('mot de passe')) {
                document.getElementById('password-error').textContent = data.error;
            } else {
                errorDiv.textContent = data.error;
                errorDiv.style.display = "block";
            }
            window.loadContent('/register/');
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    registerFormEvent();
});