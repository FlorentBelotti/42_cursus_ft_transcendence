function registerFormEvent() {
    document.getElementById("registerForm").addEventListener("submit", async function (event){
        event.preventDefault();
        let registerFormData = new FormData(event.target);
        console.log(registerFormData.get("username"))
        let response = await fetch('/register/', {
            method:"post",
            body:registerFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json()
        if (data.success) {
            window.loadContent('/home/')
        }
        // console.log(data)
    })
}

document.addEventListener("DOMContentLoaded", function () {
    registerFormEvent();
});
