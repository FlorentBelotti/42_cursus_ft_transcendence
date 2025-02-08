window.canvas = document.getElementById('pong');
window.ctx = canvas.getContext('2d');
const match = document.getElementById('matchmaking');
let socket;


match.addEventListener('click', () => {
	if (window.gameMode === 'ia' || window.gameMode === 'versus'){
		stopGame()
	}
	// gameMode = 'server';
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        initWebSocket();
    }
});

// function initWebSocket() {
//     socket = new WebSocket('ws://localhost:8000/ws/pongserver/');

//     socket.addEventListener('open', (event) => {
//         console.log('WebSocket connected');
//     });

//     socket.addEventListener('message', (event) => {
//         const gameState = JSON.parse(event.data);
//         if (gameState && gameState.pads) {
//             draw(gameState);
//         }
//         // if (gameState.waiting) {
//         //     document.getElementById('status-message').innerText = "Vous êtes en attente d'un adversaire...";
//         // } else if (gameState.waiting === false) {
//         //     document.getElementById('status-message').innerText = "Vous avez trouvé votre adversaire";
//         //     if (!countdownStarted) {
//         //         countdownStarted = true; // Éviter d'appeler `startCountdown` plusieurs fois
//         //         startCountdown();
//         //     }
//         // }
//     });

//     socket.addEventListener('close', () => {
//         console.log("WebSocket closed.");
//         if (!isPageUnloading) {
//             console.log("Reconnecting...");
//             reconnectTimeout = setTimeout(initWebSocket, 1000); // Reconnexion automatique après 1 seconde
//         }
//     });
// }

window.initWebSocket = function() {
    socket = new WebSocket('ws://localhost:8000/ws/pongserver/');

    socket.addEventListener('open', (event) => {
        console.log('WebSocket connected');
    });

    socket.addEventListener('message', (event) => {
        const gameState = JSON.parse(event.data);
        if (gameState && gameState.pads) {
            draw(gameState);
        }
    });

    socket.addEventListener('close', () => {
        console.log("WebSocket closed.");
        if (!isPageUnloading) {
            console.log("Reconnecting...");
            reconnectTimeout = setTimeout(initWebSocket, 1000);
        }
    });

    socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });
};

let countdownStarted = false;
let isPageUnloading = false;

// function startCountdown() {
//     let countdown = 3;
//     const countdownInterval = setInterval(() => {
//         ctx.clearRect(0, 0, 800, 550); // Efface tout le canvas
//         draw(); // Redessine les éléments du jeu pour éviter un écran vide
//         document.getElementById('status-message').innerText = `La partie va commencer dans ${countdown}...`;
//         countdown--;
//         if (countdown < 0) {
//             clearInterval(countdownInterval);
//             countdownStarted = false; // Réinitialiser pour une prochaine partie
//         }
//     }, 1000);
// }

function draw(gameState) {
    // if (!gameState || !gameState.pads || !gameState.ball) {
    //     console.error("Invalid game state:", gameState);
    //     return;
    // }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les raquettes
    ctx.fillStyle = 'white';
    ctx.fillRect(gameState.pads.player1.x, gameState.pads.player1.y, 20, 90);
    ctx.fillRect(gameState.pads.player2.x, gameState.pads.player2.y, 20, 90);

    // Dessiner la balle
    ctx.beginPath();
    ctx.fillRect(gameState.ball.x, gameState.ball.y, 15, 15);
    ctx.fill();
}

function sendMessage(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

document.addEventListener('keydown', (event) => {
	// if (window.gameMode === 'server'){
		let input = 0;
		if (event.key === 'ArrowUp') {
			input = -1;
		} else if (event.key === 'ArrowDown') {
			input = 1;
		}
		sendMessage({ input: input });
	// }
});

document.addEventListener('keyup', (event) => {
	// if (gameMode === 'server'){
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			sendMessage({ input: 0 });
   		}
	// }
});

window.addEventListener('beforeunload', () => {
    isPageUnloading = true; // Indique que la page est en train de se décharger
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        console.log("WebSocket closed.");
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout); // Annule la reconnexion automatique
    }
});



