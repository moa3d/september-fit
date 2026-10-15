import {
  Inject,
  Injectable,
} from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../redis/redis.constants";

@Injectable()
export class RateLimitService {
  constructor(
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {}

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ) {
    const redisKey = `ratelimit:${key}`;
    const windowSeconds = Math.max(
      1,
      Math.ceil(windowMs / 1000),
    );

    const count =
      await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.expire(
        redisKey,
        windowSeconds,
      );
    }

    const ttl =
      await this.redis.ttl(redisKey);

    return {
      allowed: count <= limit,
      remaining: Math.max(limit - count, 0),
      retryAfterSeconds:
        count <= limit
          ? 0
          : Math.max(
              ttl > 0 ? ttl : windowSeconds,
              1,
            ),
    };
  }
}
