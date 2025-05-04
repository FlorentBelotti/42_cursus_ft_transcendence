/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Modal Manager                          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side modal management system                      ║
 * ║                                                          ║
 * ║ • Handles modal open/close interactions                  ║
 * ║ • Manages matchmaking button functionality               ║
 * ║ • Simulates matchmaking process with status updates      ║
 * ║ • Provides error handling for missing elements           ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   MODAL INITIALIZATION                   //
//==========================================================//

function initModal() {
	const modal = document.getElementById('myModal');
	const openModalButton = document.getElementById('openModalButton');
	const closeModalButton = document.querySelector('.close');
	const matchmakingButton = document.getElementById('matchmaking');
	const statusText = document.getElementById('status');

	if (!modal || !openModalButton || !closeModalButton || !matchmakingButton || !statusText) {
		console.error('[MODAL]:Modal elements not found');
		return;
	}

	//==========================================================//
	//                   EVENT HANDLING                         //
	//==========================================================//

	openModalButton.addEventListener('click', () => {
		modal.style.display = 'flex';
	});

	closeModalButton.addEventListener('click', () => {
		modal.style.display = 'none';
	});

	window.addEventListener('click', (event) => {
		if (event.target === modal) {
			modal.style.display = 'none';
		}
	});

	matchmakingButton.addEventListener('click', () => {
		statusText.textContent = "Recherche de partie...";
		matchmakingButton.disabled = true;

		setTimeout(() => {
			statusText.textContent = "Partie trouvée ! 🎮";
			matchmakingButton.textContent = "Rejoindre";
			matchmakingButton.disabled = false;
		}, 3000);
	});
}

//==========================================================//
//                   INITIALIZATION                         //
//==========================================================//

document.addEventListener('DOMContentLoaded', initModal);