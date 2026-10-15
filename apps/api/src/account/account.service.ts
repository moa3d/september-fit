import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailerService } from "../mailer/mailer.service";
import { QuotaService } from "../commercial/quota.service";
import { hashPassword } from "../merchant-auth/password.crypto";
import type { InviteMemberDto } from "./dto/invite-member.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class AccountService {
  private readonly logger = new Logger(
    AccountService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly quotas: QuotaService,
  ) {}

  private hashToken(raw: string) {
    return createHash("sha256")
      .update(raw)
      .digest("hex");
  }

  async listMembers(merchantId: string) {
    const users =
      await this.prisma.merchantUser.findMany({
        where: { merchantId },
        orderBy: { createdAt: "asc" },
      });

    return {
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        verified: Boolean(
          user.emailVerifiedAt,
        ),
        disabled: Boolean(user.disabledAt),
        last_login_at: user.lastLoginAt,
        created_at: user.createdAt,
      })),
    };
  }

  async listInvitations(merchantId: string) {
    const invites =
      await this.prisma.teamInvitation.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
      });

    return {
      data: invites.map((invite) => ({
        id: invite.publicId,
        email: invite.email,
        role: invite.role,
        status: this.effectiveInviteStatus(
          invite.status,
          invite.expiresAt,
        ),
        expires_at: invite.expiresAt,
        created_at: invite.createdAt,
      })),
    };
  }

  async invite(
    merchantId: string,
    invitedById: string,
    dto: InviteMemberDto,
  ) {
    await this.quotas.assertResourceAvailable(
      merchantId,
      "TEAM_MEMBERS",
    );

    const email = dto.email
      .trim()
      .toLowerCase();

    const existingUser =
      await this.prisma.merchantUser.findFirst({
        where: {
          email,
          disabledAt: null,
        },
      });

    if (existingUser) {
      throw new ConflictException(
        existingUser.merchantId === merchantId
          ? "A team member with this email already exists."
          : "This email already belongs to another September Fit workspace. Multi-workspace accounts are not supported in V1.",
      );
    }

    const activeInvite =
      await this.prisma.teamInvitation.findFirst({
        where: {
          email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });

    if (activeInvite) {
      throw new ConflictException(
        "An active invitation already exists for this email.",
      );
    }

    const rawToken = `inv_${randomBytes(32).toString("base64url")}`;
    const tokenHash = this.hashToken(rawToken);

    const invitation =
      await this.prisma.teamInvitation.create({
        data: {
          merchantId,
          email,
          role: dto.role,
          tokenHash,
          invitedById,
          expiresAt: new Date(
            Date.now() +
              7 * 24 * 60 * 60 * 1000,
          ),
        },
      });

    const dashboardUrl = (
      process.env.DASHBOARD_PUBLIC_URL ??
      "http://localhost:3002"
    ).replace(/\/+$/, "");

    const acceptUrl =
      `${dashboardUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.mailer.send({
        to: email,
        subject: "دعوة إلى September Fit",
        text:
          `تمت دعوتك إلى فريق September Fit بدور ${dto.role}.\n\n` +
          `افتح الرابط لإكمال الحساب:\n${acceptUrl}\n\n` +
          `تنتهي صلاحية الدعوة خلال 7 أيام.`,
      });
    } catch (error) {
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
      });

      this.logger.error(
        `Failed to deliver invitation ${invitation.publicId}.`,
        error,
      );

      throw error;
    }

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType: "merchant_user",
        actorId: invitedById,
        action: "team.invitation.created",
        objectType: "team_invitation",
        objectId: invitation.id,
        metadata: {
          email,
          role: dto.role,
        },
      },
    });

    return {
      id: invitation.publicId,
      email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expiresAt,
      dev_accept_url:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : acceptUrl,
    };
  }

  async acceptInvitation(
    rawToken: string,
    password: string,
  ) {
    const invitation =
      await this.prisma.teamInvitation.findUnique({
        where: {
          tokenHash: this.hashToken(rawToken),
        },
      });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        "Invitation is invalid or expired.",
      );
    }

    await this.quotas.assertResourceAvailable(
      invitation.merchantId,
      "TEAM_MEMBERS",
    );

    const existing =
      await this.prisma.merchantUser.findFirst({
        where: {
          merchantId:
            invitation.merchantId,
          email: invitation.email,
        },
      });

    if (existing && !existing.disabledAt) {
      throw new ConflictException(
        "A user with this email already exists.",
      );
    }

    const user =
      await this.prisma.$transaction(
        async (tx) => {
          const created = existing
            ? await tx.merchantUser.update({
                where: { id: existing.id },
                data: {
                  role: invitation.role,
                  passwordHash:
                    hashPassword(password),
                  disabledAt: null,
                  emailVerifiedAt:
                    new Date(),
                },
              })
            : await tx.merchantUser.create({
                data: {
                  merchantId:
                    invitation.merchantId,
                  email: invitation.email,
                  role: invitation.role,
                  passwordHash:
                    hashPassword(password),
                  emailVerifiedAt:
                    new Date(),
                },
              });

          await tx.teamInvitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              status: "ACCEPTED",
              acceptedAt: new Date(),
            },
          });

          return created;
        },
      );

    return {
      accepted: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async updateRole(
    merchantId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateRoleDto,
  ) {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        "You cannot change your own role.",
      );
    }

    const target =
      await this.prisma.merchantUser.findFirst({
        where: {
          id: targetUserId,
          merchantId,
        },
      });

    if (!target) {
      throw new NotFoundException(
        "Team member not found.",
      );
    }

    if (target.role === "OWNER") {
      throw new ForbiddenException(
        "OWNER role cannot be changed through this endpoint.",
      );
    }

    const updated =
      await this.prisma.merchantUser.update({
        where: { id: target.id },
        data: {
          role: dto.role,
        },
      });

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorType: "merchant_user",
        actorId: actorUserId,
        action: "team.role.updated",
        objectType: "merchant_user",
        objectId: target.id,
        metadata: {
          previousRole: target.role,
          newRole: updated.role,
        },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    };
  }

  async disableMember(
    merchantId: string,
    actorUserId: string,
    targetUserId: string,
  ) {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        "You cannot disable your own account.",
      );
    }

    const target =
      await this.prisma.merchantUser.findFirst({
        where: {
          id: targetUserId,
          merchantId,
        },
      });

    if (!target) {
      throw new NotFoundException(
        "Team member not found.",
      );
    }

    if (target.role === "OWNER") {
      throw new ForbiddenException(
        "OWNER account cannot be disabled here.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.merchantUser.update({
        where: { id: target.id },
        data: {
          disabledAt: new Date(),
        },
      }),
      this.prisma.merchantSession.updateMany({
        where: {
          userId: target.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      id: target.id,
      disabled: true,
    };
  }

  async revokeInvitation(
    merchantId: string,
    publicId: string,
  ) {
    const invitation =
      await this.prisma.teamInvitation.findFirst({
        where: {
          merchantId,
          publicId,
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        "Invitation not found.",
      );
    }

    await this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    return {
      id: invitation.publicId,
      status: "REVOKED",
    };
  }

  async createVerificationToken(
    merchantId: string,
    userId: string,
  ) {
    const user =
      await this.prisma.merchantUser.findFirst({
        where: {
          id: userId,
          merchantId,
          disabledAt: null,
        },
      });

    if (!user) {
      throw new NotFoundException(
        "User not found.",
      );
    }

    if (user.emailVerifiedAt) {
      return {
        already_verified: true,
      };
    }

    const raw = `ev_${randomBytes(32).toString("base64url")}`;

    const tokenRow =
      await this.prisma.emailVerificationToken.create({
        data: {
          merchantId,
          userId,
          tokenHash: this.hashToken(raw),
          expiresAt: new Date(
            Date.now() +
              24 * 60 * 60 * 1000,
          ),
        },
      });

    const dashboardUrl = (
      process.env.DASHBOARD_PUBLIC_URL ??
      "http://localhost:3002"
    ).replace(/\/+$/, "");

    const verifyUrl =
      `${dashboardUrl}/verify-email?token=${encodeURIComponent(raw)}`;

    try {
      await this.mailer.send({
        to: user.email,
        subject: "تأكيد البريد الإلكتروني — September Fit",
        text:
          `أكد بريدك من الرابط التالي:\n${verifyUrl}\n\n` +
          `تنتهي صلاحيته خلال 24 ساعة.`,
      });
    } catch (error) {
      await this.prisma.emailVerificationToken
        .delete({
          where: { id: tokenRow.id },
        })
        .catch(() => undefined);

      this.logger.error(
        `Failed to deliver email verification for user ${user.id}.`,
        error,
      );

      throw error;
    }

    return {
      sent: true,
      dev_verify_url:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : verifyUrl,
    };
  }

  async verifyEmail(rawToken: string) {
    const token =
      await this.prisma.emailVerificationToken.findUnique({
        where: {
          tokenHash: this.hashToken(rawToken),
        },
      });

    if (
      !token ||
      token.usedAt ||
      token.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        "Verification token is invalid or expired.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.merchantUser.update({
        where: { id: token.userId },
        data: {
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      verified: true,
    };
  }

  async requestPasswordReset(emailRaw: string) {
    const email = emailRaw
      .trim()
      .toLowerCase();

    const users =
      await this.prisma.merchantUser.findMany({
        where: {
          email,
          disabledAt: null,
        },
        take: 5,
      });

    for (const user of users) {
      const raw = `pr_${randomBytes(32).toString("base64url")}`;

      const tokenRow =
        await this.prisma.passwordResetToken.create({
          data: {
            merchantId: user.merchantId,
            userId: user.id,
            tokenHash: this.hashToken(raw),
            expiresAt: new Date(
              Date.now() +
                60 * 60 * 1000,
            ),
          },
        });

      const dashboardUrl = (
        process.env.DASHBOARD_PUBLIC_URL ??
        "http://localhost:3002"
      ).replace(/\/+$/, "");

      const resetUrl =
        `${dashboardUrl}/reset-password?token=${encodeURIComponent(raw)}`;

      try {
        await this.mailer.send({
          to: user.email,
          subject: "إعادة تعيين كلمة المرور — September Fit",
          text:
            `افتح الرابط لإعادة تعيين كلمة المرور:\n${resetUrl}\n\n` +
            `تنتهي صلاحيته خلال ساعة.`,
        });
      } catch (error) {
        await this.prisma.passwordResetToken
          .delete({
            where: { id: tokenRow.id },
          })
          .catch(() => undefined);

        this.logger.error(
          `Failed to deliver password reset for user ${user.id}.`,
          error,
        );
      }
    }

    // Avoid user enumeration.
    return {
      accepted: true,
    };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ) {
    const token =
      await this.prisma.passwordResetToken.findUnique({
        where: {
          tokenHash: this.hashToken(rawToken),
        },
      });

    if (
      !token ||
      token.usedAt ||
      token.expiresAt <= new Date()
    ) {
      throw new BadRequestException(
        "Password reset token is invalid or expired.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.merchantUser.update({
        where: {
          id: token.userId,
        },
        data: {
          passwordHash:
            hashPassword(newPassword),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: {
          usedAt: new Date(),
        },
      }),
      this.prisma.merchantSession.updateMany({
        where: {
          userId: token.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      reset: true,
      sessions_revoked: true,
    };
  }

  async listSessions(
    merchantId: string,
    userId: string,
  ) {
    const sessions =
      await this.prisma.merchantSession.findMany({
        where: {
          merchantId,
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });

    return {
      data: sessions.map((session) => ({
        id: session.id,
        expires_at: session.expiresAt,
        revoked_at: session.revokedAt,
        user_agent: session.userAgent,
        created_at: session.createdAt,
      })),
    };
  }

  async revokeAllSessions(
    merchantId: string,
    userId: string,
  ) {
    const result =
      await this.prisma.merchantSession.updateMany({
        where: {
          merchantId,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

    return {
      revoked_sessions: result.count,
    };
  }

  private effectiveInviteStatus(
    status: string,
    expiresAt: Date,
  ) {
    if (
      status === "PENDING" &&
      expiresAt <= new Date()
    ) {
      return "EXPIRED";
    }
    return status;
  }
}
