export type NavRoutesType = {
  name: string;
  path: string;
  adminOnly: boolean;
  freePlanFeature?: boolean;
};

export const navRoutes: NavRoutesType[] = [
  {
    name: 'home',
    path: '/taskmate/home',
    adminOnly: false,
    freePlanFeature: true,
  },
  {
    name: 'projects',
    path: '/taskmate/projects',
    adminOnly: false,
    freePlanFeature: true,
  },
  // {
  //   name: 'schedule',
  //   path: '/taskmate/schedule',
  //   adminOnly: true,
  //   freePlanFeature: false,
  // },
  {
    name: 'reporting',
    path: '/taskmate/reporting/overview',
    adminOnly: true,
    freePlanFeature: false,
  },
];
