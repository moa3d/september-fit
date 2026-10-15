import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookEventsService } from "../webhooks/webhook-events.service";
import type { CreateProfileDto } from "./dto/create-profile.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookEventsService,
  ) {}

  async create(merchantId: string, dto: CreateProfileDto) {
    const customer = dto.external_customer_id
      ? await this.prisma.customer.upsert({
          where: {
            merchantId_externalCustomerId: {
              merchantId,
              externalCustomerId: dto.external_customer_id,
            },
          },
          update: {},
          create: {
            merchantId,
            externalCustomerId: dto.external_customer_id,
          },
        })
      : null;

    const profile = await this.prisma.fitProfile.create({
      data: {
        merchantId,
        customerId: customer?.id ?? null,
        profileType: dto.profile_type,
        preferredFit: dto.preferred_fit,
        merchantCanReadMeasurements: true,
        heightCm: dto.height_cm ?? null,
        weightKg: dto.weight_kg ?? null,
        chestCm: dto.chest_cm ?? null,
        waistCm: dto.waist_cm ?? null,
        hipsCm: dto.hips_cm ?? null,
        shoulderCm: dto.shoulder_cm ?? null,
        sleeveCm: dto.sleeve_cm ?? null,
        inseamCm: dto.inseam_cm ?? null,
        thighCm: dto.thigh_cm ?? null,
      },
    });

    return this.serialize(profile, dto.external_customer_id ?? null);
  }

  async get(merchantId: string, publicId: string) {
    const profile = await this.prisma.fitProfile.findFirst({
      where: { merchantId, publicId },
      include: { customer: true },
    });

    if (!profile) {
      throw new NotFoundException("Fit profile not found for this merchant.");
    }

    return this.serialize(profile, profile.customer?.externalCustomerId ?? null);
  }

  async update(
    merchantId: string,
    publicId: string,
    dto: UpdateProfileDto,
  ) {
    const profile = await this.prisma.fitProfile.findFirst({
      where: { merchantId, publicId },
      include: { customer: true },
    });

    if (!profile) {
      throw new NotFoundException("Fit profile not found for this merchant.");
    }

    if (!profile.merchantCanReadMeasurements) {
      throw new ForbiddenException(
        "Hosted customer measurements are private and cannot be modified through the merchant profile API.",
      );
    }

    const updated = await this.prisma.fitProfile.update({
      where: { id: profile.id },
      data: {
        profileType: dto.profile_type ?? profile.profileType,
        preferredFit: dto.preferred_fit ?? profile.preferredFit,
        heightCm: dto.height_cm ?? profile.heightCm,
        weightKg: dto.weight_kg ?? profile.weightKg,
        chestCm: dto.chest_cm ?? profile.chestCm,
        waistCm: dto.waist_cm ?? profile.waistCm,
        hipsCm: dto.hips_cm ?? profile.hipsCm,
        shoulderCm: dto.shoulder_cm ?? profile.shoulderCm,
        sleeveCm: dto.sleeve_cm ?? profile.sleeveCm,
        inseamCm: dto.inseam_cm ?? profile.inseamCm,
        thighCm: dto.thigh_cm ?? profile.thighCm,
        version: { increment: 1 },
      },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        merchantId,
        eventType: "profile.updated",
        customerId: profile.customerId,
        properties: {
          profilePublicId: profile.publicId,
          version: updated.version,
        },
      },
    });

    await this.webhooks.emit(merchantId, "profile.updated", {
      profile_id: updated.publicId,
      version: updated.version,
      external_customer_id:
        profile.customer?.externalCustomerId ?? null,
    });

    return this.serialize(
      updated,
      profile.customer?.externalCustomerId ?? null,
    );
  }

  private serialize(profile: {
    publicId: string;
    profileType: string;
    preferredFit: string;
    merchantCanReadMeasurements: boolean;
    heightCm: unknown;
    weightKg: unknown;
    chestCm: unknown;
    waistCm: unknown;
    hipsCm: unknown;
    shoulderCm: unknown;
    sleeveCm: unknown;
    inseamCm: unknown;
    thighCm: unknown;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }, externalCustomerId: string | null) {
    const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      id: profile.publicId,
      external_customer_id: externalCustomerId,
      profile_type: profile.profileType,
      preferred_fit: profile.preferredFit,
      measurements_private: !profile.merchantCanReadMeasurements,
      height_cm: profile.merchantCanReadMeasurements ? n(profile.heightCm) : null,
      weight_kg: profile.merchantCanReadMeasurements ? n(profile.weightKg) : null,
      chest_cm: profile.merchantCanReadMeasurements ? n(profile.chestCm) : null,
      waist_cm: profile.merchantCanReadMeasurements ? n(profile.waistCm) : null,
      hips_cm: profile.merchantCanReadMeasurements ? n(profile.hipsCm) : null,
      shoulder_cm: profile.merchantCanReadMeasurements ? n(profile.shoulderCm) : null,
      sleeve_cm: profile.merchantCanReadMeasurements ? n(profile.sleeveCm) : null,
      inseam_cm: profile.merchantCanReadMeasurements ? n(profile.inseamCm) : null,
      thigh_cm: profile.merchantCanReadMeasurements ? n(profile.thighCm) : null,
      version: profile.version,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    };
  }
}
