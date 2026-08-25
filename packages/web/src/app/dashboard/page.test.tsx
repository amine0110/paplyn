import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import { UiFeedbackProvider } from "@/components/ui-feedback";
import type { Project } from "@/lib/schema";

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

function renderDashboard() {
  return render(
    <UiFeedbackProvider>
      <DashboardPage />
    </UiFeedbackProvider>
  );
}

describe("Dashboard destructive actions", () => {
  beforeEach(() => {
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

    fireEvent.click(screen.getByTitle("Archive"));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to archive this project?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("uses the in-app confirm dialog for delete instead of window.confirm", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thesis Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Delete permanently"));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Permanently delete "Thesis Draft"? This removes all files and cannot be undone.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
