import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QuotaService } from "../commercial/quota.service";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { SaveMeasurementsDto } from "./dto/save-measurements.dto";

function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotas: QuotaService,
  ) {}

  async create(merchantId: string, dto: CreateProductDto) {
    const duplicate = await this.prisma.product.findFirst({
      where: {
        merchantId,
        OR: [
          { externalProductId: dto.external_product_id },
          ...(dto.sku ? [{ sku: dto.sku }] : []),
        ],
      },
    });

    if (duplicate) {
      throw new ConflictException(
        "A product with this external_product_id or SKU already exists for this merchant.",
      );
    }

    await this.quotas.assertResourceAvailable(
      merchantId,
      "PRODUCTS",
    );

    const product = await this.prisma.product.create({
      data: {
        merchantId,
        externalProductId: dto.external_product_id,
        sku: dto.sku ?? null,
        name: dto.name,
        category: dto.category.toUpperCase(),
        brand: dto.brand ?? null,
        originalSizeLabel: dto.original_size_label ?? null,
        active: dto.active ?? true,
        metadata:
          dto.metadata === undefined
            ? undefined
            : toPrismaJson(dto.metadata),
      },
    });

    return this.serialize(product);
  }

  async list(merchantId: string) {
    const products = await this.prisma.product.findMany({
      where: { merchantId },
      include: {
        measurements: {
          where: { active: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return {
      data: products.map((product) => {
        const measurement = product.measurements[0] ?? null;

        return {
          ...this.serialize(product),
          latest_measurement: measurement
            ? {
                version: measurement.version,
                quality: measurement.quality,
                fit_type: measurement.fitType,
                stretch_level: measurement.stretchLevel,
                chest_width_cm: measurement.chestWidthCm
                  ? Number(measurement.chestWidthCm)
                  : null,
                shoulder_width_cm: measurement.shoulderWidthCm
                  ? Number(measurement.shoulderWidthCm)
                  : null,
                sleeve_length_cm: measurement.sleeveLengthCm
                  ? Number(measurement.sleeveLengthCm)
                  : null,
                garment_length_cm: measurement.garmentLengthCm
                  ? Number(measurement.garmentLengthCm)
                  : null,
                waist_width_cm: measurement.waistWidthCm
                  ? Number(measurement.waistWidthCm)
                  : null,
                hip_width_cm: measurement.hipWidthCm
                  ? Number(measurement.hipWidthCm)
                  : null,
                thigh_width_cm: measurement.thighWidthCm
                  ? Number(measurement.thighWidthCm)
                  : null,
                inseam_cm: measurement.inseamCm
                  ? Number(measurement.inseamCm)
                  : null,
              }
            : null,
        };
      }),
    };
  }

  async get(merchantId: string, publicId: string) {
    const product = await this.prisma.product.findFirst({
      where: { merchantId, publicId },
      include: {
        measurements: {
          orderBy: { version: "desc" },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found for this merchant.");
    }

    return {
      ...this.serialize(product),
      measurements: product.measurements.map((m) => ({
        id: m.id,
        version: m.version,
        quality: m.quality,
        fit_type: m.fitType,
        stretch_level: m.stretchLevel,
        chest_width_cm: m.chestWidthCm ? Number(m.chestWidthCm) : null,
        shoulder_width_cm: m.shoulderWidthCm ? Number(m.shoulderWidthCm) : null,
        sleeve_length_cm: m.sleeveLengthCm ? Number(m.sleeveLengthCm) : null,
        garment_length_cm: m.garmentLengthCm ? Number(m.garmentLengthCm) : null,
        waist_width_cm: m.waistWidthCm ? Number(m.waistWidthCm) : null,
        hip_width_cm: m.hipWidthCm ? Number(m.hipWidthCm) : null,
        thigh_width_cm: m.thighWidthCm ? Number(m.thighWidthCm) : null,
        inseam_cm: m.inseamCm ? Number(m.inseamCm) : null,
        active: m.active,
        measured_by: m.measuredBy,
        measured_at: m.measuredAt,
        created_at: m.createdAt,
      })),
    };
  }

  async saveMeasurements(
    merchantId: string,
    productPublicId: string,
    dto: SaveMeasurementsDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        merchantId,
        publicId: productPublicId,
        active: true,
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found for this merchant.");
    }

    const upperCategories = new Set([
      "JACKET",
      "HOODIE",
      "SHIRT",
      "TSHIRT",
    ]);

    const lowerCategories = new Set([
      "PANTS",
      "JEANS",
    ]);

    if (
      upperCategories.has(product.category) &&
      !dto.chest_width_cm
    ) {
      throw new BadRequestException(
        "chest_width_cm is required for upper-body categories.",
      );
    }

    if (
      lowerCategories.has(product.category) &&
      !dto.waist_width_cm
    ) {
      throw new BadRequestException(
        "waist_width_cm is required for pants/jeans.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.garmentMeasurement.findFirst({
        where: { productId: product.id },
        orderBy: { version: "desc" },
      });

      await tx.garmentMeasurement.updateMany({
        where: { productId: product.id, active: true },
        data: { active: false },
      });

      const measurement = await tx.garmentMeasurement.create({
        data: {
          productId: product.id,
          version: (latest?.version ?? 0) + 1,
          quality: dto.quality,
          fitType: dto.fit_type ?? null,
          stretchLevel: dto.stretch_level,
          chestWidthCm: dto.chest_width_cm ?? null,
          shoulderWidthCm: dto.shoulder_width_cm ?? null,
          sleeveLengthCm: dto.sleeve_length_cm ?? null,
          garmentLengthCm: dto.garment_length_cm ?? null,
          waistWidthCm: dto.waist_width_cm ?? null,
          hipWidthCm: dto.hip_width_cm ?? null,
          thighWidthCm: dto.thigh_width_cm ?? null,
          inseamCm: dto.inseam_cm ?? null,
          measuredBy: dto.measured_by ?? null,
          measuredAt: new Date(),
          active: true,
        },
      });

      await tx.analyticsEvent.create({
        data: {
          merchantId,
          eventType: "product.measurements.updated",
          productId: product.id,
          properties: {
            measurementVersion: measurement.version,
            quality: measurement.quality,
          },
        },
      });

      return {
        id: measurement.id,
        product_id: product.publicId,
        version: measurement.version,
        quality: measurement.quality,
        fit_type: measurement.fitType,
        stretch_level: measurement.stretchLevel,
        active: measurement.active,
        created_at: measurement.createdAt,
      };
    });
  }

  private serialize(product: {
    publicId: string;
    externalProductId: string;
    sku: string | null;
    name: string;
    category: string;
    brand: string | null;
    originalSizeLabel: string | null;
    active: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: product.publicId,
      external_product_id: product.externalProductId,
      sku: product.sku,
      name: product.name,
      category: product.category,
      brand: product.brand,
      original_size_label: product.originalSizeLabel,
      active: product.active,
      metadata: product.metadata,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    };
  }
}
