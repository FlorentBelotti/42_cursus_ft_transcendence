/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Password Reset Request                 ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side password reset request system                ║
 * ║                                                          ║
 * ║ • Handles password reset request form submission         ║
 * ║ • Processes server responses                             ║
 * ║ • Displays success or error messages                     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   FORM HANDLING                          //
//==========================================================//

document.getElementById('resetRequestForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const formData = new FormData(e.target);
	const response = await fetch('/password_reset/', {
		method: 'POST',
		body: formData,
		headers: { 'X-CSRFToken': formData.get('csrfmiddlewaretoken') }
	});
	const data = await response.json();
	const errorMessage = document.getElementById('errorMessage');
	errorMessage.style.display = 'block';
	if (data.success) {
		errorMessage.style.color = 'green';
		errorMessage.textContent = data.success;
	} else {
		errorMessage.style.color = 'red';
		errorMessage.textContent = data.error;
	}
});