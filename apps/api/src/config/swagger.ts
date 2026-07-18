import swaggerJsdoc from "swagger-jsdoc"

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Skills Arena API",
      version: "0.1.0",
      description: "Skill-based coding contest platform",
    },
    servers: [
      { url: "http://localhost:4000", description: "development" },
    ],
    components: {
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {},
            message: { type: "string", nullable: true },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
            message: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  apis: ["./src/modules/**/*.routes.ts"],
}

export const swaggerSpec = swaggerJsdoc(options)
