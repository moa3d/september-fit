import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { CommercialModule } from "../commercial/commercial.module";

@Module({
  imports: [AuthModule, CommercialModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
