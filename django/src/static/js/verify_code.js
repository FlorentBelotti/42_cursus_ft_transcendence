function verifyCodeFormEvent() {
	const modal = document.getElementById('verifyModal');

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
            // await updateAuthButtons();
            // window.loadContent(data.redirect_url);
			// document.getElementById('verifyModal').style.display = 'none';
			modal.style.display = 'none';
            await updateAuthButtons(); // Si cette fonction existe
            window.location.href = data.redirect_url; // Redirection finale
        }
        else
        {
            console.log('Error:', "Wrong code");
            // window.loadContent(verifyCodeUrl);
            // setTimeout(() => {
            //     const errorDiv = document.getElementById("errorMessage");
            //     errorDiv.textContent = data.error;
            //     errorDiv.style.display = "block";
            // }, 100);
			const errorDiv = document.getElementById("verifyErrorMessage");
            errorDiv.textContent = data.error;
            errorDiv.style.display = "block";
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
	console.log('DOM chargé, lancement de verifyCodeFormEvent');
    verifyCodeFormEvent();
});
