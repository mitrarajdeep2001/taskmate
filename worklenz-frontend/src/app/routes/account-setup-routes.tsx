import { RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
const AccountSetup = lazy(() => import('@/pages/account-setup/account-setup'));

const accountSetupRoute: RouteObject = {
  path: '/taskmate/setup',
  element: (
    <Suspense fallback={<SuspenseFallback />}>
      <AccountSetup />
    </Suspense>
  ),
};

export default accountSetupRoute;
