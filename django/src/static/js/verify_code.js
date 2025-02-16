function verifyCodeFormEvent() {
    document.getElementById("verifyCodeForm").addEventListener("submit", async function (event){
        event.preventDefault();
        let verifyCodeFormData = new FormData(event.target);

        let user_id = localStorage.getItem('user_id');
        if (!user_id) {
            console.error("User ID not found");
            return;
        }
        let verifyCodeUrl = `/verify_code/${user_id}/`;
        console.log(verifyCodeUrl)
        let response = await fetch(verifyCodeUrl, {
            method:"post",
            body:verifyCodeFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json();
        if (data.success) {
            await updateAuthButtons();
            window.loadContent(data.redirect_url);
        } else {
            console.error("Error verifying code:", data.error);
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    verifyCodeFormEvent();
});