import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async eraseCustomer(
    merchantId: string,
    externalCustomerId: string,
  ) {
    const customer =
      await this.prisma.customer.findFirst({
        where: {
          merchantId,
          externalCustomerId,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        "Customer was not found for this merchant.",
      );
    }

    const externalIdHash = createHash("sha256")
      .update(externalCustomerId)
      .digest("hex");

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const feedback =
            await tx.fitFeedback.deleteMany({
              where: {
                merchantId,
                customerId: customer.id,
              },
            });

          const feedbackRequests =
            await tx.feedbackRequest.deleteMany({
              where: {
                merchantId,
                customerId: customer.id,
              },
            });

          // FitResult rows are cascaded through FitSession.
          const sessions =
            await tx.fitSession.deleteMany({
              where: {
                merchantId,
                customerId: customer.id,
              },
            });

          const profiles =
            await tx.fitProfile.deleteMany({
              where: {
                merchantId,
                customerId: customer.id,
              },
            });

          const analytics =
            await tx.analyticsEvent.updateMany({
              where: {
                merchantId,
                customerId: customer.id,
              },
              data: {
                customerId: null,
              },
            });

          await tx.customer.delete({
            where: { id: customer.id },
          });

          await tx.auditLog.create({
            data: {
              merchantId,
              actorType: "api_key",
              action: "privacy.customer.erased",
              objectType: "customer",
              metadata: {
                externalCustomerIdHash:
                  externalIdHash,
                sessionsDeleted:
                  sessions.count,
                profilesDeleted:
                  profiles.count,
                feedbackDeleted:
                  feedback.count,
                feedbackRequestsDeleted:
                  feedbackRequests.count,
                analyticsAnonymized:
                  analytics.count,
              },
            },
          });

          return {
            sessions: sessions.count,
            profiles: profiles.count,
            feedback: feedback.count,
            feedback_requests:
              feedbackRequests.count,
            analytics_anonymized:
              analytics.count,
          };
        },
      );

    return {
      erased: true,
      ...result,
    };
  }
}
