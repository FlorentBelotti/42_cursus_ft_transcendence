### To Do

- Romain, hurry up and push.
- Théo, hurry up and push.
- Flo, keep it up <3

### Usage

- Run an autonomous container provided by Docker: `docker-compose up --build`
- Refer to page 6 of the subject to prepare for evaluation.

### Constraints

- **Backend:** Python Django
- **Database:** See Database module
- **Frontend:** JavaScript
- **Engine:** Latest stable version of Google Chrome
- **Security:** Passwords strongly hashed in the database, SQL and XSS injection protection, HTTPS (wss), form validation -> See Security concerns on page 8
- **.env:** Ignored

### Pong

- Online real-time multiplayer on the same keyboard -> See remote players module
- Tournament with matchmaking
- Registration system (alias reset after each tournament) -> See Standard User Management module
- Same rules for every player and AI
- Respect original Pong's aesthetic
- UI

### Modules

To attain 100% project completion, a minimum of 7 major modules is required. Two minor modules are equivalent to one major module.

- **Chosen:** 70 from major, 20 from minor

**FlorentBelotti:**
- Major - Backend: Python-Django
- Minor - Accessibility: SSR from the use of Django
- Mini - Database: PostgreSQL
- Major - User: Standard user management
- Major - User: Remote authentication
- Minor - DevOps: Monitoring system
- Single page application

**RomLamb:**
- Mini - CSS: Framework Bootstrap
- Major - AI Algo : AI opponent
- Major - User : Remote player
- Major - Server: Server side pong -> if remote player
- Major - Game: Another game (snake)

**TheoGerardin:**
- Major - Cyber : Double authentification
- Minor - Cybersecurite : GDPR Compliance

### Web

- **Major module:** Use a framework to build the backend.
- **Minor module:** Use a framework or a toolkit to build the frontend.
- **Minor module:** Use a database for the backend.
- **Major module:** Store the score of a tournament in the Blockchain.

### User Management

- **Major module:** Standard user management, authentication, users across tournaments.
- **Major module:** Implementing remote authentication.

### Gameplay and User Experience

- **Major module:** Remote players
- **Major module:** Multiplayer (more than 2 in the same game).
- **Major module:** Add another game.
- **Minor module:** Game customization options.
- **Major module:** Live chat.

### AI-Algo

- **Major module:** Introduce an AI opponent.
- **Minor module:** User and game stats dashboards.

### Cybersecurity

- **Major module:** Implement WAF/ModSecurity with Hardened Configuration and HashiCorp Vault for Secrets Management.
- **Minor module:** GDPR compliance options with user anonymization, local data management, and account deletion.
- **Major module:** Implement two-factor authentication (2FA) and JWT.

### DevOps

- **Major module:** Infrastructure setup for log management.
- **Minor module:** Monitoring system.
- **Major module:** Designing the backend as microservices.

### Graphics

- **Major module:** Use of advanced 3D techniques.

### Accessibility

- **Minor module:** Support on all devices.
- **Minor module:** Expanding browser compatibility.
- **Minor module:** Multiple language supports.
- **Minor module:** Add accessibility for visually impaired users.
- **Minor module:** Server-side rendering (SSR) integration.

### Server-Side Pong

- **Major module:** Replacing basic Pong with server-side Pong and implementing an API.
- **Major module:** Enabling Pong gameplay via CLI against web users with API integration.
