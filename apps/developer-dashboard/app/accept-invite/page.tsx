import AcceptInviteClient from "./accept-invite-client";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <AcceptInviteClient token={token} />;
}
