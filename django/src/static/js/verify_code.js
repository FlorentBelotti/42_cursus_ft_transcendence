function verifyCodeFormEvent() {
    const modal = document.getElementById('verifyModal');
    const closeModalButton = document.querySelector('.close-modal');

    document.getElementById("verifyCodeForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        let verifyCodeFormData = new FormData(event.target);

        let user_id = localStorage.getItem('user_id');
        if (!user_id) {
            console.error("User ID not found");
            return;
        }
        let verifyCodeUrl = `/verify_code/${user_id}/`;
        let response = await fetch(verifyCodeUrl, {
            method: "post",
            body: verifyCodeFormData,
            headers: {
                "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
            }
        });
        let data = await response.json();
        if ('success' in data) {
            console.log('Success:', "Redirecting to home page");
            modal.style.display = 'none'; 
            await updateAuthButtons();
            window.location.href = data.redirect_url;
        } else {
            console.log('Error:', "Wrong code");
            const errorDiv = document.getElementById("verifyErrorMessage");
            errorDiv.textContent = data.error;
            errorDiv.style.display = "block";
            setTimeout(() => {
                errorDiv.style.display = "none";
            }, 3000);
        }
    });

    closeModalButton.addEventListener('click', function () {
        modal.style.display = 'none';
    });
}

document.addEventListener("DOMContentLoaded", function () {
    verifyCodeFormEvent();
});
