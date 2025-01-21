### To Do

- Romain dépêche toi de push,
- Théo dépêche toi de push,
- Flo, continue comme ça <3

### Usage

- Run an autonomouse container provided by Docker (docker-compose up --build)
- Subject page 6 to prepare evaluation.

### Constraints

- Backend: Python Django
- Database: see Database module
- Frontend: Javascript
- Engine: latest stable version of Google Chrome
- Security: password strongly hashed in database, SQL and injections/XSS protection, HTTPS (wss), validation form -> See Security concerns page 8
- .env ignored

### Pong

- Online realtime multiplayer on the same keyboard -> See remote players module
- Tournament with matchmaking
- Registration system (alias reset after each tournamenet) -> See Standard User Management module
- Same rules for every players, and AI
- Respect original Pong's aesthetic
- UI

### Modules

To attain 100% project completion, a minimum of 7 major modules is required. Two minor modules are equivalent to one Major Module.

- Chosen : 7

FlorentBelotti:
Major - Backend : Python-Django
Mini - Database : PostgreSQL
Major - User : Standard user management
Major - User : Remote authentification
Major : AI opponent

RomLamb:
Mini - CSS : framework bootstrap

TheoGerardin:
Major: WAF/ModSecurity with Hardened Configuration
and HashiCorp Vault for Secrets Management.
Major: GDPR Compliance


- Web

Major module: Use a Framework to build the backend.

Minor module: Use a framework or a toolkit to build the frontend.

Minor module: Use a database for the backend.

Major module: Store the score of a tournament in the Blockchain.

- User Management

Major module: Standard user management, authentication, users across
tournaments.

Major module: Implementing a remote authentication.

- Gameplay and user experience

Major module: Remote players

Major module: Multiplayers (more than 2 in the same game).

Major module: Add Another Game with 

- User History and Matchmaking.

Minor module: Game Customization 

- Options.

Major module: Live chat.

- AI-Algo

Major module: Introduce an AI Opponent.

Minor module: User and Game Stats Dashboards

- Cybersecurity.

Major module: Implement WAF/ModSecurity with Hardened Configuration
and HashiCorp Vault for Secrets 

- Management.

Minor module: GDPR Compliance Options with User Anonymization, Local
Data Management, and Account Deletion.

Major module: Implement Two-Factor Authentication (2FA) and JWT.

- Devops

Major module: Infrastructure Setup for Log Management.

Minor module: Monitoring system.

Major module: Designing the Backend as Microservices.

- Graphics

Major module: Use of advanced 3D techniques.

- Accessibility

Minor module: Support on all devices.

Minor module: Expanding Browser Compatibility.

Minor module: Multiple language supports.

Minor module: Add accessibility for Visually Impaired Users.

Minor module: Server-Side Rendering (SSR) Integration.

- Server-Side Pong

Major module: Replacing Basic Pong with Server-Side Pong and Imple-
menting an API.

Major module: Enabling Pong Gameplay via CLI against Web Users with
API Integration.