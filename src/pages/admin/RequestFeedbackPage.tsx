import { RequestFeedbackWorkspace } from '../../components/feedback/FeedbackCampaigns';

/**
 * Request Feedback (admin tab). The same workspace the lecturer/CEM Staff View panel and the CEM
 * programme page render — one look everywhere, scope set per account by the server
 * (see RequestFeedbackWorkspace).
 */
export function RequestFeedbackPage() {
  return <RequestFeedbackWorkspace />;
}
