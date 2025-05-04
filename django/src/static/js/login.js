/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Login Manager                          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side login form management system                 ║
 * ║                                                          ║
 * ║ • Handles login form submission                          ║
 * ║ • Manages authentication responses                       ║
 * ║ • Triggers two-factor authentication modal               ║
 * ║ • Displays error messages with timeout                   ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   FORM HANDLING                          //
//==========================================================//

function loginFormEvent() {
	document.getElementById("loginForm").addEventListener("submit", async function (event) {
		event.preventDefault();
		let loginFormData = new FormData(event.target);
		let response = await fetch('/login/', {
			method: "post",
			body: loginFormData,
			headers: {
				"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
			}
		});
		let data = await response.json();
		if ('success' in data) {
			console.log('[LOGIN]:Success:', "Redirecting to double authentication");
			localStorage.setItem('user_id', data.user_id);
			document.getElementById('verifyModal').style.display = 'block';
		} else if ('error' in data) {
			console.log('[LOGIN]:Error:', "Wrong username or password");
			const errorDiv = document.getElementById("errorMessage");
			errorDiv.textContent = data.error;
			errorDiv.style.display = "block";
			setTimeout(() => {
				errorDiv.style.display = "none";
			}, 3000);
		}
	});
}

//==========================================================//
//                   INITIALIZATION                         //
//==========================================================//

document.addEventListener("DOMContentLoaded", function () {
	loginFormEvent();
});