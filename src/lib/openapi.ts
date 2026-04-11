/**
 * OpenAPI 3.1 spec for SnowShare public API v1.
 * Generated programmatically to stay in sync with the code.
 */

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "SnowShare API",
      version: "1.0.0",
      description:
        "Public API for SnowShare — create and manage file, link, and paste shares programmatically.\n\n" +
        "## Authentication\n\n" +
        "Pass your API key in the `Authorization` header:\n\n" +
        "```\nAuthorization: Bearer sk_YOUR_API_KEY\n```\n\n" +
        "API keys are created in your [profile page](/profile). Anonymous access is allowed for share creation where permitted by server settings.\n\n" +
        "## Tus (resumable uploads)\n\n" +
        "For large files, use the tus protocol at `/api/tus`. Set the `Authorization: Bearer sk_...` header on tus requests to authenticate.",
      contact: {
        name: "SnowShare",
      },
    },
    servers: [{ url: baseUrl }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (sk_...)",
          description: "API key obtained from your profile page. Format: `sk_<32 hex chars>`",
        },
      },
      schemas: {
        Share: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["FILE", "PASTE", "URL"] },
            slug: { type: "string" },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            maxViews: { type: "integer", nullable: true },
            viewCount: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
          required: ["error", "code"],
        },
      },
    },
    paths: {
      "/api/v1/shares": {
        get: {
          operationId: "listShares",
          summary: "List own shares",
          description: "Returns all shares belonging to the authenticated user.",
          security: [{ bearerAuth: [] }],
          tags: ["Shares"],
          responses: {
            "200": {
              description: "List of shares",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Share" },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          operationId: "createShare",
          summary: "Create a link or paste share",
          tags: ["Shares"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["URL", "PASTE"],
                      description: "Type of share to create",
                    },
                    urlOriginal: {
                      type: "string",
                      description: "The URL to share (required for URL type)",
                      example: "https://example.com",
                    },
                    paste: {
                      type: "string",
                      description: "The paste content (required for PASTE type)",
                    },
                    pastelanguage: {
                      type: "string",
                      enum: [
                        "PLAINTEXT", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA",
                        "PHP", "GO", "POWERSHELL", "HTML", "CSS", "SQL", "JSON", "MARKDOWN",
                      ],
                      default: "PLAINTEXT",
                    },
                    slug: { type: "string", description: "Custom slug (3-30 alphanumeric chars, dashes, underscores)" },
                    password: { type: "string", description: "Password protection" },
                    expiresAt: { type: "string", format: "date-time", description: "Expiration date" },
                    maxViews: { type: "integer", description: "Max view count before expiry" },
                  },
                },
                examples: {
                  urlShare: {
                    summary: "Create a URL share",
                    value: { type: "URL", urlOriginal: "https://example.com", expiresAt: "2026-12-31T23:59:59Z" },
                  },
                  pasteShare: {
                    summary: "Create a paste share",
                    value: { type: "PASTE", paste: "print('hello world')", pastelanguage: "PYTHON" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Share created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { share: { $ref: "#/components/schemas/Share" } },
                  },
                },
              },
            },
            "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/v1/shares/{slug}": {
        get: {
          operationId: "getShare",
          summary: "Get share metadata",
          tags: ["Shares"],
          security: [],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Share metadata",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { share: { $ref: "#/components/schemas/Share" } },
                  },
                },
              },
            },
            "404": { description: "Share not found" },
            "410": { description: "Share expired" },
          },
        },
        delete: {
          operationId: "deleteShare",
          summary: "Delete a share",
          description: "Deletes a share. Only the owner or an admin can delete a share.",
          tags: ["Shares"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "204": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Share not found" },
          },
        },
      },
      "/api/v1/upload": {
        post: {
          operationId: "uploadFile",
          summary: "Upload a file (multipart)",
          description:
            "Upload a file via `multipart/form-data`. For large files, consider using the tus resumable upload endpoint at `/api/tus` instead.\n\n" +
            "```bash\ncurl -X POST /api/v1/upload \\\n  -H 'Authorization: Bearer sk_YOUR_API_KEY' \\\n  -F 'file=@/path/to/file.txt' \\\n  -F 'expiresAt=2026-12-31T23:59:59Z'\n```",
          tags: ["Files"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary", description: "The file to upload" },
                    slug: { type: "string" },
                    password: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" },
                    maxViews: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "File uploaded",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      share: {
                        type: "object",
                        properties: {
                          slug: { type: "string" },
                          url: { type: "string" },
                          expiresAt: { type: "string", format: "date-time", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid request" },
            "413": { description: "File too large" },
            "429": { description: "Quota exceeded" },
          },
        },
      },
    },
    tags: [
      { name: "Shares", description: "Link and paste share management" },
      { name: "Files", description: "File upload and management" },
    ],
  };
}
