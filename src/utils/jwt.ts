import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "15m";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a value of at least 32 characters.");
  }
  return secret;
}

export function assertJwtConfiguration(): void {
  getJwtSecret();
}

export const generateToken = (payload: object) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
};

export const validateToken = (token: string) => {
  const decodedPayload = jwt.verify(token, getJwtSecret());

  return decodedPayload;
};
