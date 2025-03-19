function registerFormEvent() {
    document.getElementById("registerForm").addEventListener("submit", async function (event){
        event.preventDefault();
        let registerFormData = new FormData(event.target);
        // console.log(registerFormData.get("username"))
        let response = await fetch('/register/', {
            method:"post",
            body:registerFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json()
        if ('success' in data) {
            console.log('Success:', "User created");
            window.loadContent('/home/')
        }
        else if ('error' in data) {
            console.log('Error:', "Can't create user");
            window.loadContent('/register/')
            setTimeout(() => {
                const errorDiv = document.getElementById("errorMessage");
                errorDiv.textContent = data.error;
                errorDiv.style.display = "block";
            }, 100);
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    registerFormEvent();
});
