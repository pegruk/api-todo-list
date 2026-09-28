import { Router } from "express";

import { createTodo, deleteTodo, findTodoOwner, listTodos, updateTodo } from "../repositories/todos.js";
import { authenticate } from "../middleware/authenticate.js";
import { createTodoHandlers } from "../controllers/todos.js";

const router = Router();
const handlers = createTodoHandlers({ createTodo, deleteTodo, findTodoOwner, listTodos, updateTodo });

router.use("/todos", authenticate);
router.post("/todos", handlers.create);
router.get("/todos", handlers.list);
router.put("/todos/:id", handlers.update);
router.delete("/todos/:id", handlers.remove);

export default router;
