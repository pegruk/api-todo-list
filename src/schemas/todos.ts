import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  description: z.string().trim().max(5000, "Description must be at most 5000 characters.").nullable().optional(),
}).strict();

export const updateTodoSchema = createTodoSchema;

const maxBigintId = "9223372036854775807";
export const todoIdSchema = z.string()
  .regex(/^[1-9]\d*$/, "Todo id must be a positive integer.")
  .refine((id) => id.length < maxBigintId.length || (id.length === maxBigintId.length && id <= maxBigintId), {
    message: "Todo id is too large.",
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).strict();
