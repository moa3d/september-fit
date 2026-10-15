import FeedbackFlow from "../../../components/feedback-flow";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <FeedbackFlow token={token} />;
}
