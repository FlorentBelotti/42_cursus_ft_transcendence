class TournamentClient {
    constructor() {
        this.canvas = document.getElementById('tournamentCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = null;
        this.playerPositions = [
            { x: 150, y: 150 },  // Position 1 (top-left)
            { x: 650, y: 150 },  // Position 2 (top-right)
            { x: 150, y: 400 },  // Position 3 (bottom-left)
            { x: 650, y: 400 }   // Position 4 (bottom-right)
        ];
        this.players = [];
        this.init();
    }

    init() {
        console.log('Initializing Tournament Client');
        this.connectWebSocket();
    }

    connectWebSocket() {
        const token = document.cookie
            .split('; ')
            .find(cookie => cookie.startsWith('access_token='))
            ?.split('=')[1];
            
        this.socket = new WebSocket(`ws://localhost:8000/ws/tournament/?token=${token}`);
        
        this.socket.onopen = () => {
            console.log('Tournament WebSocket connection established.');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('Tournament WebSocket connection closed.');
        };

        this.socket.onerror = (error) => {
            console.error('Tournament WebSocket error:', error);
        };
    }

    handleMessage(data) {
        console.log('Received tournament state:', data);
        
        if (data.type === 'tournament_state') {
            this.players = data.players;
            this.renderLobby(data);
        }
    }

    renderLobby(data) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw center waiting message
        this.ctx.fillStyle = 'black';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(data.message, this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw player cards in the corners
        this.players.forEach(player => {
            const position = this.playerPositions[player.position - 1];
            this.drawPlayerCard(player, position.x, position.y);
        });
        
        // Draw empty slots
        for (let i = this.players.length; i < 4; i++) {
            const position = this.playerPositions[i];
            this.drawEmptySlot(position.x, position.y);
        }
    }

    drawPlayerCard(player, x, y) {
        // Draw card background
        this.ctx.fillStyle = '#4CAF50';  // Green background
        this.ctx.fillRect(x - 100, y - 50, 200, 100);
        
        // Draw player info
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.username, x, y - 15);
        this.ctx.fillText(`ELO: ${player.elo}`, x, y + 15);
    }

    drawEmptySlot(x, y) {
        // Draw empty slot background
        this.ctx.fillStyle = '#ddd';  // Light gray
        this.ctx.fillRect(x - 100, y - 50, 200, 100);
        
        // Draw waiting text
        this.ctx.fillStyle = '#666';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('En attente...', x, y);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tournament = new TournamentClient();
});