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

function disconnectFormEvent() {
    document.getElementById("disconnectForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!confirm('Are you sure you want to disconnect?')) {
            return;
        }

        let disconnectFormData = new FormData(event.target);
        disconnectFormData.append('disconnect', 'true');

        try {
            let response = await fetch('/account/', {
                method: "post",
                body: disconnectFormData,
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
                alert('Failed to disconnect: ' + data.error);
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

document.addEventListener("DOMContentLoaded", function () {
    updateFormEvent();
    passwordFormEvent();
    deleteFormEvent();
    disconnectFormEvent();
    nicknameFormEvent();
});

