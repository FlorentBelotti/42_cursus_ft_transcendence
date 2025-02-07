const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

// Connexion au serveur WebSocket
// const socket = new WebSocket('ws://localhost:8000');
const socket = new WebSocket('ws://localhost:8000/pongServer/');

// Écouter les messages du serveur
socket.addEventListener('message', (event) => {
    const gameState = JSON.parse(event.data);

    // Mettre à jour l'affichage
    draw(gameState);
});

// Envoyer la position de la raquette au serveur
function sendPadPosition(y) {
    const message = JSON.stringify({ padY: y });
    socket.send(message);
}

// Dessiner le jeu
function draw(gameState) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les raquettes
    ctx.fillStyle = 'white';
    ctx.fillRect(gameState.pads.player1.x, gameState.pads.player1.y, 20, 90);
    ctx.fillRect(gameState.pads.player2.x, gameState.pads.player2.y, 20, 90);

    // Dessiner la balle
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, 15, 0, Math.PI * 2);
    ctx.fill();
}

// Écouter les mouvements de la souris pour déplacer la raquette
document.addEventListener('keydown', (event) => {
    let input = 0;
    if (event.key === 'ArrowUp') {
        input = -1; // Déplacer vers le haut
    } else if (event.key === 'ArrowDown') {
        input = 1; // Déplacer vers le bas
    }

    // Envoyer la commande au serveur
    const message = JSON.stringify({ input: input });
    socket.send(message);
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // Envoyer une commande neutre (arrêter le déplacement)
        const message = JSON.stringify({ input: 0 });
        socket.send(message);
    }
});
