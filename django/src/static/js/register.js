function registerFormEvent() {
    const form = document.getElementById("registerForm");
    if (!form) {
        console.error("Register form not found!");
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        document.getElementById("username-error").textContent = "";
        document.getElementById("email-error").textContent = "";
        document.getElementById("password1-error").textContent = "";
        document.getElementById("password2-error").textContent = "";

        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]");
        if (!csrfToken) {
            console.error("CSRF token not found in the form!");
            return;
        }

        const registerFormData = new FormData(event.target);

        try {
            const response = await fetch('https://pong.ovh/register/', {
                method: "POST",
                body: registerFormData,
                headers: {
                    "X-CSRFToken": csrfToken.value
                },
                credentials: 'include'
            });

            const data = await response.json();

            if ('success' in data) {
                console.log('Success:', "User created");
                window.loadContent('/login/');
            } else if ('error' in data) {
                console.log('Error:', data.error);
                if (data.errors) {
                    if (data.errors.username) {
                        document.getElementById("username-error").textContent = data.errors.username[0];
                    }
                    if (data.errors.email) {
                        document.getElementById("email-error").textContent = data.errors.email[0];
                    }
                    if (data.errors.password1) {
                        document.getElementById("password1-error").textContent = data.errors.password1[0];
                    }
                    if (data.errors.password2) {
                        document.getElementById("password2-error").textContent = data.errors.password2[0];
                    }
                } else {
                    console.log("Generic error:", data.error);
                    document.getElementById("username-error").textContent = data.error;
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            document.getElementById("username-error").textContent = "Erreur de connexion au serveur.";
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    registerFormEvent();
});
