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
        let response = await fetch(verifyCodeUrl, {
            method:"post",
            body:verifyCodeFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        })
        let data = await response.json();
        if ('success' in data) {
            console.log('Success:', "Redirecting to home page");
            await updateAuthButtons();
            window.loadContent(data.redirect_url);
        } 
        else
        {
            console.log('Error:', "Wrong code");
            window.loadContent(verifyCodeUrl);
            setTimeout(() => {
                const errorDiv = document.getElementById("errorMessage");
                errorDiv.textContent = data.error;
                errorDiv.style.display = "block";
            }, 100); 
        }
    })
}

document.addEventListener("DOMContentLoaded", function () {
    verifyCodeFormEvent();
});