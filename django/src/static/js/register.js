function registerFormEvent() {
    const form = document.getElementById("registerForm");
    if (!form) {
        console.error("Register form not found!");
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Réinitialise les messages d'erreur
        document.getElementById("username-error").textContent = "";
        document.getElementById("email-error").textContent = "";
        document.getElementById("password1-error").textContent = "";
        document.getElementById("password2-error").textContent = "";

        let registerFormData = new FormData(event.target);
        let response = await fetch('/register/', {
            method: "POST",
            body: registerFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        });
        let data = await response.json();

        if ('success' in data) {
            console.log('Success:', "User created");
            window.loadContent('/home/'); // Redirige vers la page d'accueil après succès
        } else if ('error' in data) {
            console.log('Error:', data.error);
            if (data.errors) {
                // Affiche les erreurs sous les champs correspondants
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
                // Message générique si aucune erreur spécifique
                console.log("Generic error:", data.error);
                document.getElementById("username-error").textContent = data.error;
            }
            // Pas de window.loadContent ici, on garde le formulaire tel quel
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    registerFormEvent();
});