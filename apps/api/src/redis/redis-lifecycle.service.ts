import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "./redis.constants";

@Injectable()
export class RedisLifecycleService
  implements OnApplicationShutdown
{
  constructor(
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {}

  async onApplicationShutdown() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }
}
