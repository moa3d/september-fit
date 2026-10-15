import HostedFitFlow from "../../../components/hosted-fit-flow";

export default async function HostedFitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <HostedFitFlow token={token} />;
}
