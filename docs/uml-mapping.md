# UML-to-code mapping: The Dream Server

This document maps the nine UML diagrams prepared for the OOMD mini project to the runnable implementation. Use it as a viva guide. If a diagram contains names or relationships different from those listed here, update the diagram or this mapping so both describe the same implementation.

## 1. Basic class diagram

| UML concept | Implementation | Responsibility |
|---|---|---|
| `User` | `src/models/User.js` | Account identity and safe public representation (id, username, credits) |
| `Dream` | `src/models/Dream.js` | Dream title, story, mood, author, resonance count, listing and image |
| `Listing` | `src/models/Listing.js` | Validates sale and rental prices |
| `Transaction` | `src/models/Transaction.js` | Represents a purchase, rental or welcome-credit ledger entry |

Relationships are also enforced by SQLite foreign keys: a dream may reference its author; resonances, purchases, rentals and transactions reference users and/or dreams.

## 2. Advanced class diagram

Service classes encapsulate business logic:

- `AuthService` (`src/services/AuthService.js`) registers accounts, hashes passwords with bcrypt, verifies credentials and issues/verifies JWTs.
- `DreamService` (`src/services/DreamService.js`) validates user-created dreams and creates server-origin dreams.
- `MarketService` (`src/services/MarketService.js`) toggles resonance and executes purchase/rental rules in database transactions.
- `AIDreamGenerator` (`src/services/AIDreamGenerator.js`) creates fictional dreams attributed to `Unknown`.
- `ImageService` (`src/services/ImageService.js`) searches Pexels for a relevant existing image when `PEXELS_API_KEY` is configured, ranks results using dream keywords, and falls back to locally generated SVG artwork.

## 3. Package diagram

The code is grouped into four logical packages:

- `models`: domain entities/value validation.
- `services`: application rules and orchestration.
- `routes`: HTTP endpoints and request/response handling.
- `db`: SQLite connection and schema initialization.

`server.js` is the composition root: it configures middleware, authentication, routes, seed data and the HTTP listener.

## 4. Use-case diagram

| Actor | Use case | Main endpoint / code |
|---|---|---|
| Guest | Register | `POST /api/auth/register` → `AuthService.register` |
| Guest | Log in | `POST /api/auth/login` → `AuthService.login` |
| Registered user | Browse shared dreams | `GET /api/dreams` |
| Registered user | Publish a dream | `POST /api/dreams` → `DreamService.create` |
| Registered user | Resonate with a dream | `POST /api/dreams/:id/resonate` → `MarketService.resonate` |
| Registered user | Buy a dream | `POST /api/dreams/:id/buy` → `MarketService.buy` |
| Registered user | Rent a dream | `POST /api/dreams/:id/rent` → `MarketService.rent` |
| Registered user | View own/acquired dreams | `GET /api/dreams/mine` |
| Registered user | Ask server to dream | `POST /api/dreams/ai` → `DreamService.createAIDream` |

## 5. Sequence diagram: account registration

1. Browser submits username and password to `POST /api/auth/register`.
2. Express auth route calls `AuthService.register`.
3. `AuthService` validates fields and checks username uniqueness.
4. Password is hashed using bcrypt; user is inserted with 500 credits.
5. A welcome-credit ledger entry is inserted.
6. `AuthService.issue` signs a JWT and returns token plus public user data.
7. Browser stores the token and sends it as a Bearer token for authenticated requests.

## 6. Activity diagram: publishing a dream

`User fills form` → `POST /api/dreams` → validate title/story/mood/prices → request artwork through `ImageService` → search Pexels when configured → rank relevant results → if unavailable, render procedural SVG → save selected image URL or SVG data URI → insert dream into SQLite → return dream → refresh feed.

A validation or database error returns an HTTP error instead of publishing an invalid record.

## 7. Deployment diagram

For the local demonstration:

- **Client node:** browser rendering `public/index.html`, `public/styles.css`, `public/app.js`.
- **Application node:** Node.js process running `server.js` and Express on `localhost:3000`.
- **Persistence node:** SQLite database file at `data/dream-server.sqlite`.
- **External optional service:** Pexels image-search API accessed by `ImageService` when `PEXELS_API_KEY` is configured. No paid image-generation API is required.

The app and database can run on one laptop for the viva. Other devices can use the app only if the host is reachable on the local network and firewall/network configuration allows it.

## 8. Component diagram

- **Presentation component:** `public/` frontend assets.
- **HTTP/API component:** `server.js`, `src/routes/auth.js`, `src/routes/dreams.js`, `src/routes/index.js`.
- **Identity component:** `AuthService` and `User`.
- **Dream domain component:** `Dream`, `DreamService`, `AIDreamGenerator`, `ImageService`.
- **Marketplace component:** `Listing`, `Transaction`, `MarketService`.
- **Persistence component:** `src/db/database.js` and SQLite tables.

## 9. State-chart diagram: dream lifecycle

A dream is created as a shared post, optionally listed for sale/rent. Its resonance count changes as users toggle their unique resonance. A listed dream may be purchased by a user (ownership record persists) or rented (rental is active for seven days, then expires). An AI-origin dream starts with author `Unknown` and can also be listed. The implementation stores listing and acquisition state as database records/fields rather than a single mutable `Dream.status` enum; make the UML state chart reflect these orthogonal properties.

## Important design note for the viva

Gallery search and procedural artwork are deliberately isolated behind `ImageService`, so the rest of the application does not depend on a remote provider. Likewise, the UI never directly edits credits: the server validates the action and updates the account balance and transaction records in one database transaction. This separation makes the application easier to test and explain using OOMD principles such as encapsulation, single responsibility and low coupling.


## Added profile credit features

- `src/routes/profile.js` exposes authenticated profile actions: `GET /api/profile/status`, `POST /api/profile/demo-topup`, and `POST /api/profile/spin`.
- `credit_events` stores simulated credit top-ups and daily-wheel rewards. `daily_spins` has a unique `(user_id, spin_date)` constraint so the same account cannot claim more than one spin for a UTC date.
- Credit checkout is deliberately fictional and only accepts fixed demo packs (250, 500, 1,000, or 2,000 credits). It never collects payment information.
- Wheel rewards are decided and validated on the server, not in browser JavaScript. The probability distribution is shown in the profile UI and intentionally favors zero/small rewards.
- These features extend the Profile use case and are not shown on the public feed/landing view.
