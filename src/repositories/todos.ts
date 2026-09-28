import { pool } from "../config/database.js";

export type Todo = {
  id: string;
  title: string;
  description: string | null;
};

export type TodoInput = { title: string; description?: string | null | undefined };

export async function createTodo(userId: string, input: TodoInput): Promise<Todo> {
  const result = await pool.query<Todo>(
    `INSERT INTO todos (user_id, title, description)
     VALUES ($1, $2, $3)
     RETURNING id::text AS id, title, description`,
    [userId, input.title, input.description ?? null],
  );
  const todo = result.rows[0];
  if (!todo) throw new Error("Todo insert returned no row");
  return todo;
}

export async function listTodos(userId: string, limit: number, offset: number): Promise<{ data: Todo[]; total: number }> {
  const [rows, count] = await Promise.all([
    pool.query<Todo>(
      `SELECT id::text AS id, title, description
       FROM todos WHERE user_id = $1
       ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM todos WHERE user_id = $1`, [userId]),
  ]);
  return { data: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
}

export async function findTodoOwner(todoId: string): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(`SELECT user_id::text AS user_id FROM todos WHERE id = $1`, [todoId]);
  return result.rows[0]?.user_id ?? null;
}

export async function updateTodo(todoId: string, userId: string, input: TodoInput): Promise<Todo | null> {
  const result = await pool.query<Todo>(
    `UPDATE todos SET title = $3, description = $4
     WHERE id = $1 AND user_id = $2
     RETURNING id::text AS id, title, description`,
    [todoId, userId, input.title, input.description ?? null],
  );
  return result.rows[0] ?? null;
}

export async function deleteTodo(todoId: string, userId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM todos WHERE id = $1 AND user_id = $2`, [todoId, userId]);
  return result.rowCount === 1;
}
