import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import type { Project } from "@/lib/schema";

const leaveForLogin = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-redirect", () => ({
  leaveForLogin,
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

const project: Project = {
  id: "proj-1",
  name: "Secret Paper",
  description: null,
  mainFile: "main.tex",
  compiler: "pdflatex",
  archived: false,
  ownerId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("ProjectSettingsDialog session guard", () => {
  beforeEach(() => {
    leaveForLogin.mockReset();
    useSession.mockReturnValue({ data: null, isPending: false });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ path: "main.tex" }],
    } as Response);
  });

  it("does not render project settings when signed out", () => {
    render(
      <ProjectSettingsDialog
        project={project}
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.queryByText("Project settings")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Secret Paper")).not.toBeInTheDocument();
  });
});
