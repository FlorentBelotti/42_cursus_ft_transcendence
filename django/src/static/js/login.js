function loginFormEvent() {
    document.getElementById("loginForm").addEventListener("submit", async function (event){
        event.preventDefault();
        let loginFormData = new FormData(event.target);
        console.log(loginFormData.get("username"))
        let response = await fetch('/login/', {
            method:"post",
            body:loginFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json()
        if (data.success) {
            localStorage.setItem('user_id', data.user_id);
            let verifyCodeUrl = `/verify_code/${data.user_id}/`;
            window.loadContent(verifyCodeUrl);
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    loginFormEvent();
});