import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./common/request-id.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("v1");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: {
        policy: "cross-origin",
      },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: (
      process.env.DASHBOARD_ORIGINS ??
      "http://localhost:3001,http://localhost:3002"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.use(requestIdMiddleware);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`September Fit API running on http://localhost:${port}/v1`);
}
bootstrap();
