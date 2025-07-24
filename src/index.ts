/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		return new Response('Hello World!');
// 	},
// } satisfies ExportedHandler<Env>;

import { Context, Hono, Next } from "hono";
import { z } from "zod";
import { hash, compare } from 'bcrypt-ts'

type Env = {
	DB: D1Database;
	TAIWANFRP: KVNamespace;
	// API_KEY?: string;
}

type UserRecord = {
	id: number;
	username: string;
	email: string | null;
	password: string;
	discord_user_id: string;
	create_max_proxy_count: number;
	speed_limit: number;
	is_admin: boolean;
	use_totp: boolean;
	created_at: number; // Unix timestamp in seconds
	updated_at: number; // Unix timestamp in seconds
}

const app = new Hono<{ Bindings: Env }>();

async function checkApiKey(c: Context<{ Bindings: Env }>, next: Next) {
	const apiKey = c.req.header("X-API-Key");
	if (!apiKey) {
		return c.json({ error: "API key is required" }, 401);
	}

	const kv = c.env.TAIWANFRP;
	const exists = await kv.get(`key:${apiKey}`);
	if (!exists) {
		return c.json({ error: "Invalid API key" }, 401);
	}
	// // Optionally, you can set the API key in the context for later use
	// c.set("apiKey", apiKey);
	await next();
}

app.use("/register", checkApiKey);
app.use("/login", checkApiKey);

// zod schema for registration
const registerSchema = z.object({
	username: z.string().min(4).max(64),
	password: z.string().min(8).max(256),
	// email: z.string().email().optional().or(z.literal(null)),
	email: z.union([z.email(), z.null()]).optional(),
	discord_user_id: z.string(),
	create_max_proxy_count: z.number().int().min(1).default(5).optional(),
	speed_limit: z.number().int().min(1).default(3096).optional(),
	is_admin: z.boolean().default(false).optional(),
	use_totp: z.boolean().default(false).optional(),
})

// zod schema for login
const loginSchema = z.object({
	username: z.string().min(4).max(64),
	password: z.string().min(8).max(256)
})

// register endpoint
app.post("/register", async (c) => {
	const body = await c.req.json();
	const parsedBody = registerSchema.safeParse(body);

	if (!parsedBody.success) {
		return c.json({ error: parsedBody.error.message }, 400);
	}

	const { username, password, email, discord_user_id } = parsedBody.data;

	// Check if user already exists
	const existingUser = await c.env.DB.prepare("SELECT * FROM users WHERE username = ? OR discord_user_id = ?")
		.bind(username, discord_user_id)
		.first();
	
	if (existingUser) {
		return c.json({ error: "User already exists" }, 409);
	}

	// Hash the password
	const hashedPassword = await hash(password, 10);
	const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds

	// Insert into D1 database
	const result = await c.env.DB.prepare("INSERT INTO users (username, email, password, discord_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(username, email ?? null, hashedPassword, discord_user_id, now, now)
		.run();

	if (result.success) {
		return c.json({ message: "User registered successfully" }, 201);
	} else {
		return c.json({ error: "Failed to register user" }, 500);
	}
})

// login endpoint
app.post("/login", async (c) => {
	const body = await c.req.json();
	const parsedBody = loginSchema.safeParse(body);

	if (!parsedBody.success) {
		return c.json({ error: parsedBody.error.message }, 400);
	}

	const { username, password } = parsedBody.data;

	// Fetch user from D1 database
	const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first() as UserRecord;

	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	// Compare password
	const isPasswordValid = await compare(password, user.password);
	if (!isPasswordValid) {
		return c.json({ error: "Invalid password" }, 401);
	}

	return c.json({
		message: "Login successful",
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			discord_user_id: user.discord_user_id,
			create_max_proxy_count: user.create_max_proxy_count,
			speed_limit: user.speed_limit,
			is_admin: user.is_admin,
			use_totp: user.use_totp,
			created_at: user.created_at,
			updated_at: user.updated_at
		}
	}, 200);
})

app.get("/", (c) => {
	return c.text("Welcome to the TaiwanFRP Auth API!");
});

app.get("/health", (c) => {
	return c.json({ status: "ok" });
});

export default app;