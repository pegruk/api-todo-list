# Todo List API

REST API for user accounts and private todo lists, built with Node.js, Express, TypeScript and PostgreSQL.

## Requirements

- Node.js 20 or newer
- PostgreSQL

## Run locally

```sh
npm install
cp .env.example .env
```

Set `DATABASE_URL` to your PostgreSQL connection string. Replace `JWT_SECRET` with a secret of at least 32 characters; for example, generate one with `openssl rand -base64 32`.

Create the database, then apply the schema:

```sh
createdb todo_list_api
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_create_users_and_todos.sql
```

Run the checks and start the API:

```sh
npm test
npm run build
npm run dev
```

The server checks the database connection and required environment variables before listening. Production start command after building: `npm start`.

## Endpoints

| Method and path | Auth | Description |
| --- | --- | --- |
| `POST /register` | No | Register with `{ "name", "email", "password" }`; responds `201 { "token" }`. |
| `POST /login` | No | Log in with `{ "email", "password" }`; responds `200 { "token" }`. |
| `POST /todos` | Bearer token | Create with `{ "title", "description" }`; responds `201` and the created todo. |
| `GET /todos?page=1&limit=10` | Bearer token | List the caller's todos with pagination metadata. `limit` is 1–100. |
| `PUT /todos/:id` | Bearer token | Replace a todo's title and description; another user's todo responds `403`. |
| `DELETE /todos/:id` | Bearer token | Delete a todo; success responds `204` without a body. |

Pass tokens in `Authorization: Bearer <token>`. Validation failures respond `422`; missing or invalid tokens respond `401`. A todo belonging to another user responds `403`, and a nonexistent todo responds `404`.

## Tests

`npm test` runs isolated controller and authentication middleware tests. They use fake repositories and do not require a running PostgreSQL server. The SQL schema itself is applied separately with the migration command above.
