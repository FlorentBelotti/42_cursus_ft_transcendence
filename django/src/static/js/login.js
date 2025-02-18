function loginFormEvent() {
    document.getElementById("loginForm").addEventListener("submit", async function (event){
        event.preventDefault();
        let loginFormData = new FormData(event.target);
        let response = await fetch('/login/', {
            method:"post",
            body:loginFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json()
        if ('success' in data) {
            console.log('Success:', "Redirecting to double authentication");
            localStorage.setItem('user_id', data.user_id);
            let verifyCodeUrl = `/verify_code/${data.user_id}/`;
            window.loadContent(verifyCodeUrl);
        }
        else if ('error' in data) {
            console.log('Error:', "Wrong username or password");
            window.loadContent('/login/');
            setTimeout(() => {
                const errorDiv = document.getElementById("errorMessage");
                errorDiv.textContent = data.error;
                errorDiv.style.display = "block";
            }, 100); 
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    loginFormEvent();
});