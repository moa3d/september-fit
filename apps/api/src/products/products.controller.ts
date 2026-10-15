import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { RequireScopes, ScopesGuard } from "../auth/scopes";
import { CreateProductDto } from "./dto/create-product.dto";
import { SaveMeasurementsDto } from "./dto/save-measurements.dto";
import { ProductsService } from "./products.service";

@Controller("products")
@UseGuards(ApiKeyGuard, ScopesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @RequireScopes("products:write")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    return this.products.create(req.merchant.merchantId, dto);
  }

  @Get(":productId")
  @RequireScopes("products:read")
  get(@Req() req: AuthenticatedRequest, @Param("productId") productId: string) {
    return this.products.get(req.merchant.merchantId, productId);
  }

  @Put(":productId/measurements")
  @RequireScopes("products:write")
  measurements(
    @Req() req: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() dto: SaveMeasurementsDto,
  ) {
    return this.products.saveMeasurements(
      req.merchant.merchantId,
      productId,
      dto,
    );
  }
}
