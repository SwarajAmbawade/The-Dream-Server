# The Dream Server
Live-on : https://the-dream-server.onrender.com/

The Dream Server is an OOMD mini project inspired by *Inception*. Users can share dreams, explore dream artwork, resonate with posts, and buy or rent listed dreams using fictional credits. The “Unclaimed Dreams” area explores the idea of dreams nobody remembers creating.

## Image matching, quota protection, and local artwork

- Pixabay searches use one concise scene-focused query per new dream, then score image tags against key subjects and mood. Weak matches fall back to local procedural SVG artwork instead of displaying an obviously unrelated photo.
- Search responses, including empty results, are cached for at least 24 hours as required by Pixabay.
- The application imposes a stricter local safety cap of 8 Pixabay searches per minute (well below Pixabay's documented default of 100 requests per 60 seconds), uses request timeouts, and enters a cooldown after HTTP 429. It does not automatically retry rate-limited calls.
- Pixabay images that are selected are downloaded into `public/generated-images` instead of being permanently hotlinked. Contributor and source attribution are retained.
- For reliable, more accurate visuals, put your own AI-generated or otherwise licensed images in `public/assets/dreams/` and map lowercase dream titles to filenames in `public/assets/dream-images.json`. These local assets are checked first and never consume Pixabay quota. See `public/assets/dreams/README.md`.
- To refresh images for all dreams in your current local SQLite database without making any Pixabay calls, stop the server and run `npm run refresh-dream-art`. Existing dreams use mapped local assets when present, otherwise their own scene-specific procedural SVG.

Pixabay's official documentation states that responses must be cached for 24 hours, the default API limit is 100 requests per 60 seconds, and persistent image display requires downloading images to your own server. See https://pixabay.com/api/docs/.

## Technology stack

- **Frontend:** HTML, CSS, browser JavaScript
- **Backend:** Node.js 20+ and Express
- **Database:** SQLite (`better-sqlite3`), created automatically on first run
- **Authentication:** bcrypt password hashing and signed JWT bearer tokens
- **Artwork:** Pixabay image search with downloaded local image caching, plus procedural SVG fallback artwork

Node.js, Express, and SQLite were chosen because they are straightforward to run and demonstrate for a college mini project, while supporting clear object-oriented classes and persistent multi-user data.

## Features

- Registration and login with server-side bcrypt password hashes
- 500 welcome credits per account
- Profile-only simulated credit checkout with 250/500/1,000/2,000-credit packs (maximum 2,000 credits per checkout; no real payment processing)
- One server-validated lucky-wheel spin per UTC day, with intentionally low rewards and disclosed probabilities
- Profile credit activity history for demo top-ups and wheel rewards
- Shared dream feed and five moods: Lucid, Peaceful, Surreal, Recurring, and Nightmare
- Resonance stored per account, preventing repeated likes from the same user
- Dream sharing with artwork generated or selected when the dream is created
- Optional sale and rental listings
- Marketplace showing popular listed dreams
- Server-side purchase and seven-day rental operations with balance checks and transaction records
- My Dreams view for authored and acquired dreams
- Unclaimed dream generation with author `Unknown`
- Responsive graphite, sage, and amber visual design
- Deterministic procedural SVG art with layered landscapes, atmospheric lighting, scene-specific objects, and mood-aware palettes
- Pixabay search for relevant existing images; selected images are downloaded locally and cached; local procedural artwork is used when the API is unavailable
- Starter dreams seeded into SQLite on first run
- Built-in starter dreams play locally stored MP4s on a silent, automatic loop with no visible playback controls; the written dream story stays beside the video for a reading-first experience
- Newly created dreams use the local interactive story viewer, with scene changes and choices generated from the title/story (no video-generation API required)
- The Share a Dream form offers a lightweight, local title-based story suggestion with basic typo corrections. It makes no LLM calls, sends no text to an external service, and only fills the story when the user chooses “Use this story”.

## Dream watching and writing assistance

- **Built-in dreams with mapped videos:** matching local videos in `public/assets/dream-videos/` autoplay muted and loop continuously with native controls hidden. The full written story is displayed beside the video in four named sections. The viewer uses a fixed layout so different video dimensions do not resize the popup.
- **New user-created dreams:** these do not trigger video generation. “Watch dream” opens the four-scene interactive reading experience; the title and story determine the scene text and choices. This works locally without another API or additional cost.
- **Title-to-story suggestion:** while typing a title, the app creates a draft description using lightweight keyword templates and a small correction list for common typos. It is deliberately not an LLM. The user must click **Use this story**, and can edit the draft before publishing. This is a writing aid, not a full spell-checker or a guarantee that every title will be interpreted correctly.

Add your matching MP4 files under `public/assets/dream-videos/` and update `public/assets/dream-videos.json` if filenames differ from the built-in mapping. Keep video files you have permission to use; do not download or redistribute videos without checking their licence.

## Artwork strategy

The app does **not** require an OpenAI, Pexels, or Unsplash API key.

1. The server builds a compact image-search query from meaningful words in the dream title and story, with mood-related terms.
2. It searches Pixabay for an image related to the dream title, story, and mood.
3. It ranks results using image titles and tags, then saves the chosen image URL alongside creator, licence, and source information.
4. Artwork attribution is displayed below the dream story and in the image detail modal.
5. If the API times out, is rate-limited, returns no usable image, or cannot be reached, the server generates local procedural SVG artwork instead.
6. The selected image and attribution are stored with the dream, so opening the feed does not trigger another gallery search.

Pixabay finds existing images; it does not generate a new image that exactly recreates a dream. Relevance is approximate. Selected images are downloaded into `public/generated-images` because Pixabay does not permit permanent hotlinking, and API searches are cached for 24 hours. The local renderer remains available as a fallback. The UI displays the contributor and a link to the Pixabay source page. Review the [Pixabay Content License](https://pixabay.com/service/license-summary/) before public or commercial use.

Get a free key and review the [Pixabay API documentation](https://pixabay.com/api/docs/).

## Requirements

- Node.js 20 or newer
- npm
- Internet access and a `PIXABAY_API_KEY` for Pixabay image searches; procedural artwork works locally without a key

## Run locally

1. Extract the ZIP and open a terminal in the project directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS/Linux**

   ```bash
   cp .env.example .env
   ```

4. Open `.env` and replace `JWT_SECRET` with a random string at least 32 characters long. Do not commit or share `.env`.
5. Set `PIXABAY_API_KEY` in `.env` using your rotated key. If Pixabay is unavailable or the key is absent, local procedural artwork is selected automatically.
6. Start the app:

   ```bash
   npm start
   ```

7. Open [http://localhost:3000](http://localhost:3000) and register an account. The database is created at `data/dream-server.sqlite` by default.

For automatic server restarts during development, run `npm run dev`.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `JWT_SECRET` | Signs authentication tokens; use 32+ random characters | Required |
| `DATABASE_FILE` | SQLite database file | `./data/dream-server.sqlite` |
| Image gallery | Pixabay API | Free API key; images downloaded locally; procedural artwork is the fallback |

## Useful commands

```bash
npm start     # Run the application
npm run dev   # Run with automatic restarts
npm test      # Run domain tests
npm run check # Check JavaScript syntax for key entry points
```

## API outline

All endpoints except health, login, and registration require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Current account |
| `GET` | `/api/dreams` | Shared feed with user-specific flags |
| `POST` | `/api/dreams` | Create a dream and select its artwork |
| `GET` | `/api/dreams/mine` | Authored, purchased, or rented dreams |
| `POST` | `/api/dreams/:id/resonate` | Toggle resonance |
| `POST` | `/api/dreams/:id/buy` | Buy a listed dream |
| `POST` | `/api/dreams/:id/rent` | Rent for seven days |
| `POST` | `/api/dreams/ai` | Generate an unclaimed dream |
| `GET` | `/api/dreams/transactions` | Current user's transaction history |
| `GET` | `/api/profile/status` | Daily wheel eligibility and recent credit events |
| `POST` | `/api/profile/demo-topup` | Simulate a top-up of 250, 500, 1,000, or 2,000 credits |
| `POST` | `/api/profile/spin` | Claim one daily lucky-wheel result |

## OOMD / viva notes

- `User`, `Dream`, `Listing`, and `Transaction` are domain model classes.
- `AuthService` handles registration, password hashing, login, and token validation.
- `DreamService` validates submissions and coordinates artwork selection.
- `MarketService` owns resonance, purchase, and rental business rules.
- `AIDreamGenerator` creates fictional unknown-origin dreams.
- `ImageService` encapsulates gallery search, result selection, and local SVG rendering.
- Route files expose the HTTP interface; `server.js` configures Express and middleware.
- SQLite constraints and transactions protect core data relationships and market operations.
- See [`docs/uml-mapping.md`](docs/uml-mapping.md) for the diagram-to-code mapping and suggested viva explanation.

## Limitations and security notes

- Credits are fictional. The profile checkout is a clearly labelled simulation; it does not charge money, accept card details, or connect to a payment provider. There is no creator payout. The daily wheel is intentionally weighted: 45% chance of 0 credits, 30% of 5, 15% of 10, 7% of 25, 2% of 50, and 1% of 100. These odds are shown in the profile.
- The app stores JWT bearer tokens in browser `localStorage`. Passwords are hashed, but cross-site scripting could expose a token. A public production deployment should use a reviewed authentication design, HTTPS, secure cookie handling where appropriate, and stronger deployment hardening.
- Selected gallery images are stored locally when downloaded by the image pipeline; manually supplied videos and artwork belong in the documented `public/assets/` folders.
- This is a college learning project and demo marketplace, not a production financial service. Before accepting real payments or opening it to a large public audience, review authentication, add moderation, and use a production-grade database and image storage.
- SQLite is suitable for a local demonstration and a small project. A higher-concurrency deployment may need PostgreSQL and managed image storage.

## Troubleshooting

- **Server exits because `JWT_SECRET` is missing:** create `.env` from `.env.example` and set a random secret of at least 32 characters.
- **`better-sqlite3` installation fails:** use Node.js 20+ and rerun `npm install`.
- **Pexels search fails:** verify the key, internet connection, API access, and current rate limits. The service logs a warning and falls back to local artwork.
- **Reset the local demo database:** stop the server and delete `data/dream-server.sqlite`. This removes local accounts and dreams; starter dreams are seeded on the next launch.


## Profile, credits, and Watch Dream

- Click the username in the top-right corner to open the profile.
- Profile tabs separate dreams created by the user, purchased dreams, and active rentals.
- The profile alone contains the simulated credit checkout and daily lucky wheel; neither feature is placed on the landing/feed page.
- Each demo checkout adds one selected pack (250, 500, 1,000, or 2,000 credits). A request cannot add more than 2,000 credits at a time. This is not real payment processing.
- The wheel is available once per UTC date per account. The server stores the result in SQLite and enforces the daily limit. The probability table is intentionally biased toward 0 or small rewards and is displayed to the user.
- Credit top-ups and wheel rewards are recorded in a credit activity history.
- **Built-in starter dreams:** matching local MP4s autoplay muted and loop without visible player controls; the four-part written story stays beside the video. Use H.264 MP4 files and the exact names in `public/assets/dream-videos/README.md` / `public/assets/dream-videos.json`.
- **New user-created dreams:** use the interactive four-scene story experience rather than generating a video. The title-based story suggestion uses local templates and typo corrections, not an LLM or external service.

## Deployment

### Suggested option: Railway

Railway is a straightforward deployment route for this Node/Express project. **Important:** the SQLite database must live on a persistent volume; otherwise account and dream data can be lost when the container is replaced.

1. Put the project in a GitHub repository. Do not commit `.env`, database files, or API keys.
2. In Railway, create a new project and deploy from that GitHub repository.
3. In the service settings, set the start command to `npm start` (the build/install step is `npm install`).
4. Add a persistent volume and mount it at `/app/data` (confirm the service's working directory; if it differs, use the matching absolute path).
5. Add environment variables in Railway: `NODE_ENV=production`, `JWT_SECRET` (a unique random secret of 32+ characters), and `DATABASE_FILE=/app/data/dream-server.sqlite`. Add `PIXABAY_API_KEY` only if you want live image search. Keep the key private.
6. Generate a public domain in Railway's networking settings.
7. Open the domain and test registration, logout/login, dream creation, profile checkout, daily spin, buy/rent, and Watch Dream.
8. Keep your local `.env` out of GitHub. Do not test by entering real card details; the checkout is fictional.

### Alternative: Render

Render can also host the Node service, but choose a persistent disk and mount it where `DATABASE_FILE` points. A deployment without persistent storage is suitable only for a disposable demo because SQLite data may reset on redeploy.

### Before calling it production-ready

The project is ready for a **college demo deployment**, not for real money or sensitive customer data. The app uses SQLite, JWTs in browser localStorage, and a fake payment flow. Real payments would require a legitimate provider and server-side verification; do not treat the demo checkout as secure payment infrastructure.
