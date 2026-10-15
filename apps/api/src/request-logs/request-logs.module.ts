import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { RequestLogInterceptor } from "./request-log.interceptor";

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLogInterceptor,
    },
  ],
})
export class RequestLogsModule {}
