import type { ReactNode } from "react";

export function AppShellLayout({
  gallery,
  galleryLayoutTransitioning,
  inspector,
  inspectorCollapsed,
  modalOpen,
  selectionMode,
  sidebar,
  statusbar,
  toolbar,
}: {
  gallery: ReactNode;
  galleryLayoutTransitioning: boolean;
  inspector?: ReactNode;
  inspectorCollapsed: boolean;
  modalOpen: boolean;
  selectionMode: boolean;
  sidebar: ReactNode;
  statusbar: ReactNode;
  toolbar: ReactNode;
}) {
  return (
    <div className={`app-shell ${selectionMode ? "selection-mode" : ""}`}>
      <div className="app-content" aria-hidden={modalOpen ? true : undefined}>
        {toolbar}
        <main
          className={`workspace ${inspectorCollapsed ? "inspector-collapsed" : ""} ${
            galleryLayoutTransitioning ? "gallery-layout-transitioning" : ""
          }`}
        >
          {sidebar}
          {gallery}
          {inspector}
        </main>
        {statusbar}
      </div>
    </div>
  );
}
