import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/classes")({
  component: ClassesLayout,
});

function ClassesLayout() {
  return <Outlet />;
}
