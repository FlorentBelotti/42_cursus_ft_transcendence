/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Account Management                     ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side account management system                    ║
 * ║                                                          ║
 * ║ • Handles form submissions for account updates           ║
 * ║ • Manages password changes                               ║
 * ║ • Processes account deletion                             ║
 * ║ • Facilitates logout functionality                       ║
 * ║ • Updates nickname and profile information               ║
 * ║ • Initializes account page with user data                ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   FORM HANDLING                          //
//==========================================================//

function updateFormEvent() {
	document.getElementById("updateForm").addEventListener("submit", async function (event) {
		event.preventDefault();
		let updateFormData = new FormData(event.target);
		updateFormData.append('update_info', 'true');

		try {
			let response = await fetch('/account/', {
				method: "post",
				body: updateFormData,
				headers: {
					"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
					"X-Requested-With": "XMLHttpRequest"
				}
			});

			let data = await response.json();
			console.log('[ACCOUNT]:Response data:', data);

			if ('success' in data) {
				console.log('[ACCOUNT]:Success:', data.success);
				window.loadContent('/account/');
			} else if ('error' in data) {
				console.log('[ACCOUNT]:Error:', data.error);
				if (data.errors) {
					console.log('[ACCOUNT]:Validation errors:', data.errors);
					if (data.errors.username) {
						document.getElementById("errorUsername").innerHTML = `<span class="error-message">${data.errors.username.join(', ')}</span>`;
					}
					if (data.errors.email) {
						document.getElementById("errorEmail").innerHTML = `<span class="error-message">${data.errors.email.join(', ')}</span>`;
					}
					if (data.errors.profile_picture) {
						document.getElementById("errorPicture").innerHTML = `<span class="error-message">${data.errors.profile_picture.join(', ')}</span>`;
					}
				} else {
					alert('Erreur lors de la mise à jour du compte : ' + data.error);
				}
				console.log('[ACCOUNT]:Validation errors:', data.errors);
			}
		} catch (error) {
			console.error('[ACCOUNT]:Fetch error:', error);
		}
	});
}

function passwordFormEvent() {
	document.getElementById("passwordForm").addEventListener("submit", async function (event) {
		event.preventDefault();
		let passwordFormData = new FormData(event.target);
		passwordFormData.append('change_password', 'true');

		try {
			let response = await fetch('/account/', {
				method: "post",
				body: passwordFormData,
				headers: {
					"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
					"X-Requested-With": "XMLHttpRequest"
				}
			});

			let data = await response.json();
			console.log('[ACCOUNT]:Response data:', data);

			if ('success' in data) {
				console.log('[ACCOUNT]:Success:', data.success);
				window.loadContent('/account/');
			} else if ('error' in data) {
				console.log('[ACCOUNT]:Error:', data.error);
				if (data.errors) {
					console.log('[ACCOUNT]:Validation errors:', data.errors);
				}
			}
		} catch (error) {
			console.error('[ACCOUNT]:Fetch error:', error);
		}
	});
}

function deleteFormEvent() {
	document.getElementById("deleteForm").addEventListener("submit", async function (event) {
		event.preventDefault();

		if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
			return;
		}

		let deleteFormData = new FormData(event.target);
		deleteFormData.append('delete_account', 'true');

		try {
			let response = await fetch('/account/', {
				method: "post",
				body: deleteFormData,
				headers: {
					"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
					"X-Requested-With": "XMLHttpRequest"
				}
			});

			let data = await response.json();

			if ('success' in data) {
				console.log('[ACCOUNT]:Success:', data.success);
				await updateAuthButtons();
				window.loadContent('/home/');
			} else if ('error' in data) {
				console.log('[ACCOUNT]:Error:', data.error);
				alert('Failed to delete account: ' + data.error);
			}
		} catch (error) {
			console.error('[ACCOUNT]:Fetch error:', error);
			alert('An error occurred while trying to delete your account.');
		}
	});
}

function nicknameFormEvent() {
	document.getElementById("nicknameForm").addEventListener("submit", async function (event) {
		event.preventDefault();
		let nicknameFormData = new FormData(event.target);
		nicknameFormData.append('update_nickname', 'true');

		try {
			let response = await fetch('/account/', {
				method: "post",
				body: nicknameFormData,
				headers: {
					"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
					"X-Requested-With": "XMLHttpRequest"
				}
			});

			let data = await response.json();
			console.log('[ACCOUNT]:Response data:', data);

			if ('success' in data) {
				console.log('[ACCOUNT]:Success:', data.success);
				window.loadContent('/account/');
			} else if ('error' in data) {
				console.log('[ACCOUNT]:Error:', data.error);
				if (data.errors) {
					console.log('[ACCOUNT]:Validation errors:', data.errors);
					if (data.errors.nickname) {
						document.getElementById("errorNickname").innerHTML = `<span class="error-message">${data.errors.nickname.join(', ')}</span>`;
					}
				}
			}
		} catch (error) {
			console.error('[ACCOUNT]:Fetch error:', error);
		}
	});
}


//==========================================================//
//                   INITIALIZATION                         //
//==========================================================//

async function initAccountPage() {
	try {
		const response = await fetch('/api/users/me/', {
			method: 'GET',
			headers: {
				"X-Requested-With": "XMLHttpRequest"
			},
			credentials: 'include'
		});

		const data = await response.json();
		if (data.status === 'success' && data.user.last_login !== null) {
			const passwordFormSection = document.getElementById('passwordForm');
			if (passwordFormSection) {
				passwordFormSection.style.display = 'none';
			}
		}
	} catch (error) {
		console.error('[ACCOUNT]:Error fetching user info:', error);
	}
	updateFormEvent();
	passwordFormEvent();
	deleteFormEvent();
	nicknameFormEvent();

	const buttons = document.querySelectorAll('.sidebar-btn');
	buttons.forEach(button => {
		button.addEventListener('click', () => {
			const sectionId = button.getAttribute('data-section');
			const section = document.getElementById(sectionId);
			const windowHeight = window.innerHeight;
			const sectionHeight = section.offsetHeight;
			const scrollPosition = section.offsetTop - (windowHeight / 2) + (sectionHeight / 2);

			window.scrollTo({
				top: scrollPosition,
				behavior: 'smooth'
			});

			buttons.forEach(btn => btn.classList.remove('active'));
			button.classList.add('active');
		});
	});
}

document.addEventListener("DOMContentLoaded", initAccountPage);

window.initAccountPage = initAccountPage;