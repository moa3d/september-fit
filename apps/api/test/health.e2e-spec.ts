import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /v1/health/live", async () => {
    await request(app.getHttpServer())
      .get("/v1/health/live")
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
      });
  });
});
