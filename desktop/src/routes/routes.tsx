import { createRoute } from "@tanstack/react-router";
import { RootRoute } from "./__root";
import HomePage from "@/pages/home-page";
import HostedFilePage from "@/pages/hosted-file-page";
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";

// TODO: Steps to add a new route:
// 1. Create a new page component in the '../pages/' directory (e.g., NewPage.tsx)
// 2. Import the new page component at the top of this file
// 3. Define a new route for the page using createRoute()
// 4. Add the new route to the routeTree in RootRoute.addChildren([...])
// 5. Add a new Link in the navigation section of RootRoute if needed

// Example of adding a new route:
// 1. Create '../pages/NewPage.tsx'
// 2. Import: import NewPage from '../pages/NewPage';
// 3. Define route:
//    const NewRoute = createRoute({
//      getParentRoute: () => RootRoute,
//      path: '/new',
//      component: NewPage,
//    });
// 4. Add to routeTree: RootRoute.addChildren([HomeRoute, NewRoute, ...])
// 5. Add Link: <Link to="/new">New Page</Link>

export const HomePageRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});

export const HostedPageFileRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/hosted-files",
  component: HostedFilePage,
});

export const LoginPageRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/login",
  component: LoginPage,
});

export const RegisterPageRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/register",
  component: RegisterPage,
});

export const rootTree = RootRoute.addChildren([
  HomePageRoute,
  HostedPageFileRoute,
  LoginPageRoute,
  RegisterPageRoute,
]);
