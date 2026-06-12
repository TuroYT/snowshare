-- API keys stored with a bcrypt-hashed keyHash were non-functional:
-- bcrypt is randomised so the same raw key produces a different hash on every call,
-- making findUnique({ where: { keyHash } }) always miss.
-- The hashing algorithm has been changed to SHA-256 (deterministic).
-- All existing keys must be deleted so users generate new, working ones.
DELETE FROM "ApiKey";
