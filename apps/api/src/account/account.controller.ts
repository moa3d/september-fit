import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  MerchantRolesGuard,
  RequireMerchantRoles,
} from "../merchant-auth/merchant-roles";
import { MerchantSessionGuard } from "../merchant-auth/merchant-session.guard";
import type { DashboardRequest } from "../merchant-auth/merchant-auth.types";
import { AccountService } from "./account.service";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@Controller()
export class AccountController {
  constructor(
    private readonly account: AccountService,
  ) {}

  @Get("team/members")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  members(@Req() req: DashboardRequest) {
    return this.account.listMembers(
      req.dashboardUser.merchantId,
    );
  }

  @Get("team/invitations")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  invitations(@Req() req: DashboardRequest) {
    return this.account.listInvitations(
      req.dashboardUser.merchantId,
    );
  }

  @Post("team/invitations")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  invite(
    @Req() req: DashboardRequest,
    @Body() dto: InviteMemberDto,
  ) {
    return this.account.invite(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
      dto,
    );
  }

  @Delete("team/invitations/:id")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  revokeInvite(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
  ) {
    return this.account.revokeInvitation(
      req.dashboardUser.merchantId,
      id,
    );
  }

  @Patch("team/members/:id/role")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER")
  updateRole(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.account.updateRole(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
      id,
      dto,
    );
  }

  @Delete("team/members/:id")
  @UseGuards(
    MerchantSessionGuard,
    MerchantRolesGuard,
  )
  @RequireMerchantRoles("OWNER", "ADMIN")
  disableMember(
    @Req() req: DashboardRequest,
    @Param("id") id: string,
  ) {
    return this.account.disableMember(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
      id,
    );
  }

  @Post("auth/accept-invite")
  acceptInvite(
    @Body() dto: AcceptInviteDto,
  ) {
    return this.account.acceptInvitation(
      dto.token,
      dto.password,
    );
  }

  @Post("auth/request-password-reset")
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ) {
    return this.account.requestPasswordReset(
      dto.email,
    );
  }

  @Post("auth/reset-password")
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return this.account.resetPassword(
      dto.token,
      dto.new_password,
    );
  }

  @Post("auth/verify-email")
  verifyEmail(
    @Body() dto: VerifyEmailDto,
  ) {
    return this.account.verifyEmail(
      dto.token,
    );
  }

  @Post("account/send-verification")
  @UseGuards(MerchantSessionGuard)
  sendVerification(
    @Req() req: DashboardRequest,
  ) {
    return this.account.createVerificationToken(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
    );
  }

  @Get("account/sessions")
  @UseGuards(MerchantSessionGuard)
  sessions(@Req() req: DashboardRequest) {
    return this.account.listSessions(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
    );
  }

  @Post("account/sessions/revoke-all")
  @UseGuards(MerchantSessionGuard)
  revokeAll(
    @Req() req: DashboardRequest,
  ) {
    return this.account.revokeAllSessions(
      req.dashboardUser.merchantId,
      req.dashboardUser.userId,
    );
  }
}
