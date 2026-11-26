import { AiReviewScreen } from './AiReviewScreen';

/** Keep existing deep links and navigation working with the new drawer. */
export function AiHistoryScreen() {
  return <AiReviewScreen initialHistory />;
}
