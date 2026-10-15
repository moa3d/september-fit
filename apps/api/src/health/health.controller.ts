import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS } from "../redis/redis.constants";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {}

  @Get("live")
  live() {
    return {
      status: "ok",
      service: "september-fit-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready() {
    try {
      await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.redis.ping(),
      ]);

      return {
        status: "ready",
        database: "ok",
        redis: "ok",
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        database: "error",
        redis: "error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get()
  health() {
    return this.live();
  }
}
