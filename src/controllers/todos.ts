import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import { createTodoSchema, paginationSchema, todoIdSchema, updateTodoSchema } from "../schemas/todos.js";
import type { TodoInput } from "../repositories/todos.js";

type TodoRecord = { id: string; title: string; description: string | null };
type TodoDependencies = {
  createTodo: (userId: string, input: TodoInput) => Promise<TodoRecord>;
  listTodos: (userId: string, limit: number, offset: number) => Promise<{ data: TodoRecord[]; total: number }>;
  findTodoOwner: (todoId: string) => Promise<string | null>;
  updateTodo: (todoId: string, userId: string, input: TodoInput) => Promise<TodoRecord | null>;
  deleteTodo: (todoId: string, userId: string) => Promise<boolean>;
};

function validationResponse(response: Response, issues: { path: PropertyKey[]; message: string }[]) {
  return response.status(422).json({
    message: "Validation failed.",
    errors: issues.map(({ path, message }) => ({ path, message })),
  });
}

function getUserId(request: Request): string {
  return (request as AuthenticatedRequest).userId;
}

export function createTodoHandlers(dependencies: TodoDependencies) {
  return {
    create: async (request: Request, response: Response) => {
      const validation = createTodoSchema.safeParse(request.body);
      if (!validation.success) return validationResponse(response, validation.error.issues);
      try {
        const todo = await dependencies.createTodo(getUserId(request), validation.data);
        return response.status(201).json(todo);
      } catch (error) {
        console.error("Failed to create todo", error);
        return response.status(500).json({ message: "Internal server error." });
      }
    },

    list: async (request: Request, response: Response) => {
      const validation = paginationSchema.safeParse(request.query);
      if (!validation.success) return validationResponse(response, validation.error.issues);
      const { page, limit } = validation.data;
      const offset = (page - 1) * limit;
      if (!Number.isSafeInteger(offset)) {
        return response.status(422).json({ message: "Validation failed.", errors: [{ path: ["page"], message: "Page is too large." }] });
      }
      try {
        const result = await dependencies.listTodos(getUserId(request), limit, offset);
        return response.status(200).json({ ...result, page, limit });
      } catch (error) {
        console.error("Failed to list todos", error);
        return response.status(500).json({ message: "Internal server error." });
      }
    },

    update: async (request: Request, response: Response) => {
      const idValidation = todoIdSchema.safeParse(request.params.id);
      if (!idValidation.success) return validationResponse(response, idValidation.error.issues);
      const bodyValidation = updateTodoSchema.safeParse(request.body);
      if (!bodyValidation.success) return validationResponse(response, bodyValidation.error.issues);

      const userId = getUserId(request);
      try {
        const ownerId = await dependencies.findTodoOwner(idValidation.data);
        if (!ownerId) return response.status(404).json({ message: "Todo not found." });
        if (ownerId !== userId) return response.status(403).json({ message: "Forbidden" });

        const todo = await dependencies.updateTodo(idValidation.data, userId, bodyValidation.data);
        if (!todo) return response.status(404).json({ message: "Todo not found." });
        return response.status(200).json(todo);
      } catch (error) {
        console.error("Failed to update todo", error);
        return response.status(500).json({ message: "Internal server error." });
      }
    },

    remove: async (request: Request, response: Response) => {
      const idValidation = todoIdSchema.safeParse(request.params.id);
      if (!idValidation.success) return validationResponse(response, idValidation.error.issues);
      const userId = getUserId(request);
      try {
        const ownerId = await dependencies.findTodoOwner(idValidation.data);
        if (!ownerId) return response.status(404).json({ message: "Todo not found." });
        if (ownerId !== userId) return response.status(403).json({ message: "Forbidden" });
        if (!(await dependencies.deleteTodo(idValidation.data, userId))) {
          return response.status(404).json({ message: "Todo not found." });
        }
        return response.status(204).end();
      } catch (error) {
        console.error("Failed to delete todo", error);
        return response.status(500).json({ message: "Internal server error." });
      }
    },
  };
}
