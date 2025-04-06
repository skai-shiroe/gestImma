import { t } from "elysia";

const signupBodySchema = t.Object({
  name: t.String({ maxLength: 60, minLength: 1 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
  isAdult: t.Boolean(),
});

const loginBodySchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
});

export { loginBodySchema, signupBodySchema };
