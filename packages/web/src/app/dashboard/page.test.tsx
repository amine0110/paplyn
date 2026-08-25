import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import { UiFeedbackProvider } from "@/components/ui-feedback";
import type { Project } from "@/lib/schema";

const leaveForLogin = vi.hoisted(() => vi.fn());
const mockUseRequireSession = vi.hoisted(() =>
  vi.fn(() => ({ isAuthenticated: true }))
);

vi.mock("@/lib/auth-redirect", () => ({
  leaveForLogin,
}));

vi.mock("@/lib/use-require-session", () => ({
  useRequireSession: (...args: unknown[]) => mockUseRequireSession(...args),
}));

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/project-settings-dialog", () => ({
  ProjectSettingsDialog: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const sampleProject: Project = {
  id: "proj-1",
  name: "Thesis Draft",
  description: null,
  mainFile: "main.tex",
  compiler: "pdflatex",
  archived: false,
  ownerId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const archivedProject: Project = {
  ...sampleProject,
  id: "proj-2",
  name: "Old Notes",
  archived: true,
  updatedAt: "2025-12-01T00:00:00.000Z",
};

function renderDashboard() {
  return render(
    <UiFeedbackProvider>
      <DashboardPage />
    </UiFeedbackProvider>
  );
}

describe("Dashboard header layout", () => {
  beforeEach(() => {
    leaveForLogin.mockReset();
    mockUseRequireSession.mockReturnValue({ isAuthenticated: true });
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ owned: [], shared: [] }),
    } as Response);
  });

  it("stacks the title above actions on small screens with wrapping action row", () => {
    renderDashboard();

    const heading = screen.getByRole("heading", { name: "Projects", level: 1 });
    const header = heading.parentElement;

    expect(header).not.toBeNull();
    expect(header).toHaveClass("flex-col", "gap-4", "sm:flex-row", "sm:items-center", "sm:justify-between");

    const actions = header?.querySelector(".flex-wrap");
    expect(actions).not.toBeNull();
    expect(actions).toHaveClass("flex-wrap", "gap-2", "sm:justify-end");
  });

  it("keeps Import GitHub and exposes icon-only actions with aria-labels for mobile", () => {
    renderDashboard();

    expect(screen.getByRole("button", { name: "Import GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import zip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();

    const githubButton = screen.getByRole("button", { name: "Import GitHub" });
    expect(githubButton.querySelector(".hidden.sm\\:inline")).toHaveTextContent("Import GitHub");

    const zipButton = screen.getByRole("button", { name: "Import zip" });
    expect(zipButton.querySelector(".hidden.sm\\:inline")).toHaveTextContent("Import zip");

    const newButton = screen.getByRole("button", { name: "New project" });
    expect(newButton.querySelector(".hidden.sm\\:inline")).toHaveTextContent("New project");
  });
});

describe("Dashboard destructive actions", () => {
  beforeEach(() => {
    leaveForLogin.mockReset();
    mockUseRequireSession.mockReturnValue({ isAuthenticated: true });
    vi.restoreAllMocks();
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ owned: [sampleProject], shared: [] }),
    } as Response);
  });

  it("uses the in-app confirm dialog for archive instead of window.confirm", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Project actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive/i }));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    expect(screen.getByText("Are you sure you want to archive this project?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("uses the in-app confirm dialog for delete instead of window.confirm", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Project actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/i }));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Permanently delete "Thesis Draft"? This removes all files and cannot be undone.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

describe("Dashboard archived projects", () => {
  beforeEach(() => {
    leaveForLogin.mockReset();
    mockUseRequireSession.mockReturnValue({ isAuthenticated: true });
    vi.restoreAllMocks();
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ owned: [sampleProject, archivedProject], shared: [] }),
    } as Response);
  });

  it("keeps active and archived projects in separate sections when show archived is on", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    expect(screen.queryByText("Old Notes")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Archived" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));

    const yourProjectsSection = screen.getByRole("heading", { name: "Your projects" }).closest("section");
    const archivedSection = screen.getByRole("heading", { name: "Archived" }).closest("section");

    expect(yourProjectsSection).not.toBeNull();
    expect(archivedSection).not.toBeNull();
    expect(within(yourProjectsSection!).getByText("Thesis Draft")).toBeInTheDocument();
    expect(within(yourProjectsSection!).queryByText("Old Notes")).not.toBeInTheDocument();
    expect(within(archivedSection!).getByText("Old Notes")).toBeInTheDocument();
    expect(within(archivedSection!).queryByText("Thesis Draft")).not.toBeInTheDocument();
  });

  it("uses distinct archive and unarchive controls with matching accessible names", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    const archiveButton = screen.getByRole("button", { name: "Archive" });
    expect(archiveButton).toHaveAttribute("title", "Archive");

    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));

    const unarchiveButton = screen.getByRole("button", { name: "Unarchive" });
    expect(unarchiveButton).toHaveAttribute("title", "Unarchive");
    expect(unarchiveButton).not.toBe(archiveButton);
  });

  it("exposes project actions through a mobile menu instead of hover-only buttons", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    const mobileMenu = screen.getByRole("button", { name: "Project actions" });
    expect(mobileMenu).toHaveClass("h-11", "w-11");
    expect(mobileMenu.closest(".md\\:hidden")).not.toBeNull();

    fireEvent.click(mobileMenu);
    expect(screen.getByRole("menuitem", { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Archive/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Delete/i })).toBeInTheDocument();
  });

  it("uses the in-app confirm dialog for unarchive instead of window.confirm", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));

    await waitFor(() => {
      expect(screen.getByText("Old Notes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to unarchive this project?")).toBeInTheDocument();
  });
});

describe("Dashboard session loss", () => {
  beforeEach(() => {
    leaveForLogin.mockReset();
    mockUseRequireSession.mockReturnValue({ isAuthenticated: true });
    vi.restoreAllMocks();
  });

  it("clears project lists and redirects on 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    renderDashboard();

    await waitFor(() => {
      expect(leaveForLogin).toHaveBeenCalledWith("/dashboard");
    });

    expect(screen.queryByText("Thesis Draft")).not.toBeInTheDocument();
  });

  it("does not render project lists when unauthenticated", () => {
    mockUseRequireSession.mockReturnValue({ isAuthenticated: false });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ owned: [sampleProject], shared: [] }),
    } as Response);

    renderDashboard();

    expect(screen.queryByText("Thesis Draft")).not.toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
