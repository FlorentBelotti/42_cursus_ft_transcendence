function updateFormEvent() {
    document.getElementById("updateForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let updateFormData = new FormData(event.target);
        updateFormData.append('update_info', 'true');

        try {
            let response = await fetch('/account/', {
                method: "post",
                body: updateFormData,
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = await response.json();
            console.log('Response data:', data);

            if ('success' in data) {
                console.log('Success:', data.success);
                window.loadContent('/account/');
            } else if ('error' in data) {
                console.log('Error:', data.error);
                if (data.errors) {
                    console.log('Validation errors:', data.errors);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
    });
}

function logoutFormEvent() {
    const logoutForm = document.getElementById("logoutForm");

    logoutForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        try {
            let response = await fetch('{% url "api/logout_action" %}', {
                method: 'POST',
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = await response.json();
            if ('success' in data) {
                console.log('Déconnexion réussie:', data.success);
                window.location.href = '/home/';
            } else if ('error' in data) {
                console.log('Erreur:', data.error);
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    });
}


function passwordFormEvent() {
    document.getElementById("passwordForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let passwordFormData = new FormData(event.target);
        passwordFormData.append('change_password', 'true');

        try {
            let response = await fetch('/account/', {
                method: "post",
                body: passwordFormData,
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = await response.json();
            console.log('Response data:', data);

            if ('success' in data) {
                console.log('Success:', data.success);
                window.loadContent('/account/');
            } else if ('error' in data) {
                console.log('Error:', data.error);
                if (data.errors) {
                    console.log('Validation errors:', data.errors);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
    });
}

function deleteFormEvent() {
    document.getElementById("deleteForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        let deleteFormData = new FormData(event.target);
        deleteFormData.append('delete_account', 'true');

        try {
            let response = await fetch('/account/', {
                method: "post",
                body: deleteFormData,
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = await response.json();

            if ('success' in data) {
                console.log('Success:', data.success);
                await updateAuthButtons();
                window.loadContent('/home/');
            } else if ('error' in data) {
                console.log('Error:', data.error);
                alert('Failed to delete account: ' + data.error);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert('An error occurred while trying to delete your account.');
        }
    });
}

function nicknameFormEvent() {
    document.getElementById("nicknameForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let nicknameFormData = new FormData(event.target);
        nicknameFormData.append('update_nickname', 'true');

        try {
            let response = await fetch('/account/', {
                method: "post",
                body: nicknameFormData,
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            let data = await response.json();
            console.log('Response data:', data);

            if ('success' in data) {
                console.log('Success:', data.success);
                window.loadContent('/account/');
            } else if ('error' in data) {
                console.log('Error:', data.error);
                if (data.errors) {
                    console.log('Validation errors:', data.errors);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
    });
}

function initAccountPage() {
    updateFormEvent();
    passwordFormEvent();
    deleteFormEvent();
    // logoutFormEvent();
    nicknameFormEvent();

    const buttons = document.querySelectorAll('.sidebar-btn');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            const section = document.getElementById(sectionId);
            const windowHeight = window.innerHeight;
            const sectionHeight = section.offsetHeight;
            const scrollPosition = section.offsetTop - (windowHeight / 2) + (sectionHeight / 2);

            window.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });

            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

document.addEventListener("DOMContentLoaded", initAccountPage);

window.initAccountPage = initAccountPage;
