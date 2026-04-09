import { redirect } from 'next/navigation';

/** Analytics is merged into the main Dashboard at `/admin`. */
export default function AnalyticsRedirectPage() {
  redirect('/admin');
}
