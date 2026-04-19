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
                        "PLAINTEXT",
                        "JAVASCRIPT",
                        "TYPESCRIPT",
                        "PYTHON",
                        "JAVA",
                        "PHP",
                        "GO",
                        "POWERSHELL",
                        "HTML",
                        "CSS",
                        "SQL",
                        "JSON",
                        "MARKDOWN",
                      ],
                      default: "PLAINTEXT",
                    },
                    slug: {
                      type: "string",
                      description: "Custom slug (3-30 alphanumeric chars, dashes, underscores)",
                    },
                    password: { type: "string", description: "Password protection" },
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                      description: "Expiration date",
                    },
                    maxViews: { type: "integer", description: "Max view count before expiry" },
                  },
                },
                examples: {
                  urlShare: {
                    summary: "Create a URL share",
                    value: {
                      type: "URL",
                      urlOriginal: "https://example.com",
                      expiresAt: "2026-12-31T23:59:59Z",
                    },
                  },
                  pasteShare: {
                    summary: "Create a paste share",
                    value: {
                      type: "PASTE",
                      paste: "print('hello world')",
                      pastelanguage: "PYTHON",
                    },
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
            "400": {
              description: "Invalid request",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
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
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
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
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "204": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "404": { description: "Share not found" },
          },
        },
      },
      "/api/tus": {
        post: {
          operationId: "tusCreateUpload",
          summary: "Create a resumable upload (tus)",
          description:
            "Create a new resumable file upload using the [tus protocol](https://tus.io/).\n\n" +
            "## How tus works\n\n" +
            "1. **POST** `/api/tus` with `Upload-Length` and `Upload-Metadata` headers to create an upload\n" +
            "2. Server returns `Location` header with the upload URL (e.g., `/api/tus/abc123`)\n" +
            "3. **PATCH** the upload URL with file chunks (`Content-Type: application/offset+octet-stream`)\n" +
            "4. **HEAD** the upload URL to check progress (`Upload-Offset` header)\n" +
            "5. On completion, server returns `X-Share-Slug` header with the share slug\n\n" +
            "## Metadata\n\n" +
            "Pass metadata in the `Upload-Metadata` header as base64-encoded key-value pairs:\n\n" +
            "```\nUpload-Metadata: filename <base64>,slug <base64>,password <base64>\n```\n\n" +
            "| Key | Description |\n" +
            "|-----|-------------|\n" +
            "| `filename` | Original filename (required) |\n" +
            "| `slug` | Custom slug (3-30 chars, alphanumeric + `-_`) |\n" +
            "| `password` | Password protection (plain text, will be hashed) |\n" +
            "| `expiresAt` | ISO 8601 expiration date |\n" +
            "| `maxViews` | Max view count |\n" +
            "| `filetype` | MIME type |\n\n" +
            "## Bulk uploads\n\n" +
            "For uploading multiple files as a single share:\n\n" +
            "| Key | Description |\n" +
            "|-----|-------------|\n" +
            "| `isBulk` | Set to `true` for bulk uploads |\n" +
            "| `fileIndex` | 0-based index of the file |\n" +
            "| `totalFiles` | Total number of files |\n" +
            "| `bulkShareId` | Share ID returned from first file (for subsequent files) |\n" +
            "| `relativePath` | Relative path within the archive |\n\n" +
            "## Example (curl)\n\n" +
            "```bash\n" +
            "# 1. Create upload\n" +
            "LOCATION=$(curl -s -D - -X POST /api/tus \\\n" +
            "  -H 'Authorization: Bearer sk_YOUR_API_KEY' \\\n" +
            "  -H 'Tus-Resumable: 1.0.0' \\\n" +
            "  -H 'Upload-Length: 12345' \\\n" +
            "  -H 'Upload-Metadata: filename $(echo -n \"file.txt\" | base64)' \\\n" +
            "  | grep -i location | cut -d' ' -f2 | tr -d '\\r')\n\n" +
            "# 2. Upload content\n" +
            'curl -X PATCH "$LOCATION" \\\n' +
            "  -H 'Tus-Resumable: 1.0.0' \\\n" +
            "  -H 'Upload-Offset: 0' \\\n" +
            "  -H 'Content-Type: application/offset+octet-stream' \\\n" +
            "  --data-binary @file.txt\n" +
            "```",
          tags: ["Files"],
          security: [],
          parameters: [
            {
              name: "Tus-Resumable",
              in: "header",
              required: true,
              schema: { type: "string", enum: ["1.0.0"] },
              description: "tus protocol version",
            },
            {
              name: "Upload-Length",
              in: "header",
              required: true,
              schema: { type: "integer" },
              description: "Total file size in bytes",
            },
            {
              name: "Upload-Metadata",
              in: "header",
              required: false,
              schema: { type: "string" },
              description:
                "Base64-encoded metadata pairs (e.g., `filename <base64>,slug <base64>`)",
            },
          ],
          responses: {
            "201": {
              description: "Upload created",
              headers: {
                Location: {
                  description: "URL for PATCH/HEAD requests",
                  schema: { type: "string" },
                },
                "Tus-Resumable": {
                  description: "tus protocol version",
                  schema: { type: "string" },
                },
              },
            },
            "400": { description: "Invalid slug format" },
            "409": { description: "Slug already taken" },
            "413": { description: "File too large" },
            "429": { description: "IP quota exceeded" },
          },
        },
        options: {
          operationId: "tusOptions",
          summary: "Get tus server capabilities",
          description: "Returns supported tus extensions and version.",
          tags: ["Files"],
          security: [],
          responses: {
            "204": {
              description: "Server capabilities",
              headers: {
                "Tus-Resumable": { schema: { type: "string" } },
                "Tus-Version": { schema: { type: "string" } },
                "Tus-Extension": { schema: { type: "string" } },
                "Tus-Max-Size": { schema: { type: "integer" } },
              },
            },
          },
        },
      },
      "/api/tus/{uploadId}": {
        head: {
          operationId: "tusGetUploadStatus",
          summary: "Get upload progress",
          description: "Returns the current upload offset. Use to resume interrupted uploads.",
          tags: ["Files"],
          security: [],
          parameters: [
            { name: "uploadId", in: "path", required: true, schema: { type: "string" } },
            {
              name: "Tus-Resumable",
              in: "header",
              required: true,
              schema: { type: "string", enum: ["1.0.0"] },
            },
          ],
          responses: {
            "200": {
              description: "Upload status",
              headers: {
                "Upload-Offset": {
                  description: "Current byte offset",
                  schema: { type: "integer" },
                },
                "Upload-Length": {
                  description: "Total file size",
                  schema: { type: "integer" },
                },
              },
            },
            "404": { description: "Upload not found" },
          },
        },
        patch: {
          operationId: "tusPatchUpload",
          summary: "Upload file chunk",
          description:
            "Send file data starting at the specified offset. On completion, response includes `X-Share-Slug` header.",
          tags: ["Files"],
          security: [],
          parameters: [
            { name: "uploadId", in: "path", required: true, schema: { type: "string" } },
            {
              name: "Tus-Resumable",
              in: "header",
              required: true,
              schema: { type: "string", enum: ["1.0.0"] },
            },
            {
              name: "Upload-Offset",
              in: "header",
              required: true,
              schema: { type: "integer" },
              description: "Byte offset to resume from (0 for new uploads)",
            },
            {
              name: "Content-Type",
              in: "header",
              required: true,
              schema: { type: "string", enum: ["application/offset+octet-stream"] },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/offset+octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          responses: {
            "204": {
              description: "Chunk uploaded (or upload complete)",
              headers: {
                "Upload-Offset": {
                  description: "New byte offset after this chunk",
                  schema: { type: "integer" },
                },
                "X-Share-Slug": {
                  description: "Share slug (only on completion)",
                  schema: { type: "string" },
                },
                "X-Share-Id": {
                  description: "Share ID (only on completion)",
                  schema: { type: "string" },
                },
              },
            },
            "404": { description: "Upload not found" },
            "409": { description: "Offset mismatch" },
          },
        },
        delete: {
          operationId: "tusDeleteUpload",
          summary: "Cancel an upload",
          description: "Terminates an in-progress upload and cleans up temporary files.",
          tags: ["Files"],
          security: [],
          parameters: [
            { name: "uploadId", in: "path", required: true, schema: { type: "string" } },
            {
              name: "Tus-Resumable",
              in: "header",
              required: true,
              schema: { type: "string", enum: ["1.0.0"] },
            },
          ],
          responses: {
            "204": { description: "Upload cancelled" },
            "404": { description: "Upload not found" },
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
      {
        name: "Files",
        description:
          "File upload and management. Supports both multipart form uploads (`/api/v1/upload`) and resumable tus protocol uploads (`/api/tus`) for large files.",
      },
    ],
  };
}
