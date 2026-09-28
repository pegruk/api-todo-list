import { z } from "zod";

export const registerAuth = z.object({
  name: z.string({
    required_error: "Name is required",
    invalid_type_error: "Name must be a string",
  }).trim().min(3, "Name must be at least 3 characters"),

  email: z.string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a valid",
  }).trim().email(),

  password: z.string({
    required_error: "Password is required",
    invalid_type_error: "Password must be a string",
  }).min(8, "Password must be at least 8 characters"),
}).strict();
