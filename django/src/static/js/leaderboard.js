/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                   Leaderboard Manager                    ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║ Client-side leaderboard management system                ║
 * ║                                                          ║
 * ║ • Fetches and updates leaderboard data                   ║
 * ║ • Handles refresh button interactions                    ║
 * ║ • Manages error states and UI feedback                   ║
 * ╚══════════════════════════════════════════════════════════╝
 */

//==========================================================//
//                   LEADERBOARD FETCHING                   //
//==========================================================//

function refreshLeaderboard() {
	fetch('/leaderboard/', {
		headers: {
			'X-Requested-With': 'XMLHttpRequest'
		}
	})
	.then(response => {
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return response.text();
	})
	.then(html => {
		const contentContainer = document.querySelector('#content-container');
		if (contentContainer) {
			contentContainer.innerHTML = html;
		}
	})
	.catch(error => {
		console.error('[LEADERBOARD]:There was a problem with the fetch operation:', error);
		const tableBody = document.querySelector('#leaderboard-table tbody');
		if (tableBody) {
			tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-500">Une erreur est survenue lors du chargement du classement.</td></tr>';
		}
	});
}

//==========================================================//
//                   EVENT HANDLING                         //
//==========================================================//

document.addEventListener('DOMContentLoaded', function() {
	const refreshButton = document.getElementById('refresh-leaderboard');
	if (refreshButton) {
		refreshButton.addEventListener('click', function() {
			refreshLeaderboard();
		});
	}
	// setInterval(refreshLeaderboard, 60000);
});