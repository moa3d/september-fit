import { Global, Module } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "./redis.constants";
import { RedisLifecycleService } from "./redis-lifecycle.service";

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const url =
          process.env.REDIS_URL ??
          "redis://localhost:6379";

        return new Redis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        });
      },
    },
    RedisLifecycleService,
  ],
  exports: [REDIS],
})
export class RedisModule {}
