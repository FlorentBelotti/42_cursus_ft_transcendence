function updateFormEvent() {
    document.getElementById("updateForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let updateFormData = new FormData(event.target);
        // Add the update_info field to FormData
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

document.addEventListener("DOMContentLoaded", function () {
    updateFormEvent();
    passwordFormEvent();
});