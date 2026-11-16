import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGetSharesQuery } from "../queries/share-query";
import ShareList from "./share-list";

vi.mock("../queries/share-query", () => ({ useGetSharesQuery: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/date-locale", () => ({
  useDateFnsLocale: () => undefined,
  formatLocalized: () => "Nov 16, 2026",
}));
vi.mock("@/features/page/page.utils", () => ({
  buildSharedPageUrl: () => "/share/page",
}));
vi.mock("@/lib", () => ({ getPageIcon: () => null }));
vi.mock("./share-action-menu", () => ({ default: () => null }));
vi.mock("@/components/ui/custom-avatar", () => ({ CustomAvatar: () => null }));

function page(title: string | null, nextCursor?: string, hasPrevPage = false) {
  return {
    items: title
      ? [
          {
            id: title,
            key: title,
            page: { title, slugId: title, icon: null },
            creator: { name: "Member", avatarUrl: null },
            createdAt: "2026-11-16T00:00:00Z",
          },
        ]
      : [],
    meta: { hasNextPage: Boolean(nextCursor), hasPrevPage, nextCursor },
  };
}

function renderPages(pages: Record<string, ReturnType<typeof page>>) {
  vi.mocked(useGetSharesQuery).mockImplementation(
    ({ cursor }) =>
      ({
        data: pages[cursor ?? "first"],
        isLoading: false,
      }) as ReturnType<typeof useGetSharesQuery>,
  );

  render(
    <MantineProvider env="test">
      <MemoryRouter>
        <ShareList />
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ShareList pagination", () => {
  it("reaches accessible shares after an empty permission-filtered first page", () => {
    renderPages({
      first: page(null, "second"),
      second: page("Accessible page", undefined, true),
    });

    expect(screen.getByText("No shared pages")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Prev" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("link", { name: "Accessible page" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("No shared pages")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("navigates forwards and backwards through an empty middle page", () => {
    renderPages({
      first: page("First page", "second"),
      second: page(null, "third", true),
      third: page("Last page", undefined, true),
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("No shared pages")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("link", { name: "Last page" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("No shared pages")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByRole("link", { name: "First page" })).toBeTruthy();
  });

  it("allows returning from an empty last page", () => {
    renderPages({
      first: page("First page", "last"),
      last: page(null, undefined, true),
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("No shared pages")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByRole("link", { name: "First page" })).toBeTruthy();
  });

  it("keeps a genuinely empty list free of pagination controls", () => {
    renderPages({ first: page(null) });

    expect(screen.getByText("No shared pages")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prev" })).toBeNull();
  });

  it("does not show pagination for a single populated page", () => {
    renderPages({ first: page("Only page") });

    expect(screen.getByRole("link", { name: "Only page" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});
