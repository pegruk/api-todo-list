import express from "express";
import authRoutes from "./routes/auth.js";
import todoRoutes from "./routes/todos.js";

const app = express();

app.use(express.json());
app.use(authRoutes);
app.use(todoRoutes);

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Hello World!" });
});

app.use((_request, response) => {
  return response.status(404).json({ message: "Route not found." });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    return response.status(400).json({ message: "Invalid JSON body." });
  }
  console.error("Unhandled request error", error);
  return response.status(500).json({ message: "Internal server error." });
});

export default app;
