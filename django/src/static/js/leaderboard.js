document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/users/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Trier les utilisateurs par ELO décroissant
            data.sort((a, b) => b.elo - a.elo);

            // Sélectionner le corps du tableau
            const tbody = document.getElementById('leaderboard').getElementsByTagName('tbody')[0];

            // Insérer les données dans le tableau
            data.forEach(user => {
                const row = tbody.insertRow();
                const cellNickname = row.insertCell(0);
                const cellElo = row.insertCell(1);
                cellNickname.textContent = user.nickname;
                cellElo.textContent = user.elo;
            });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
});