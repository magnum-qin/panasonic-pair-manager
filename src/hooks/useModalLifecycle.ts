import { useCallback, useMemo, useState } from "react";

type ModalName = "about" | "settings" | "delete";

export function useModalLifecycle() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closingModal, setClosingModal] = useState<ModalName | null>(null);

  const closeModal = useCallback((modal: ModalName, setOpen: (open: boolean) => void) => {
    setClosingModal(modal);
    window.setTimeout(() => {
      setOpen(false);
      setClosingModal((current) => (current === modal ? null : current));
    }, 160);
  }, []);

  const openAbout = useCallback(() => {
    setClosingModal(null);
    setAboutOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setClosingModal(null);
    setSettingsOpen(true);
  }, []);

  const openDelete = useCallback(() => {
    setClosingModal(null);
    setDeleteOpen(true);
  }, []);

  const closeAbout = useCallback(() => {
    closeModal("about", setAboutOpen);
  }, [closeModal]);

  const closeSettings = useCallback(() => {
    closeModal("settings", setSettingsOpen);
  }, [closeModal]);

  const closeDelete = useCallback(() => {
    closeModal("delete", setDeleteOpen);
  }, [closeModal]);

  const modalOpen = aboutOpen || settingsOpen || deleteOpen;

  return useMemo(
    () => ({
      aboutOpen,
      closeAbout,
      closeDelete,
      closeSettings,
      closingModal,
      deleteOpen,
      modalOpen,
      openAbout,
      openDelete,
      openSettings,
      settingsOpen,
    }),
    [
      aboutOpen,
      closeAbout,
      closeDelete,
      closeSettings,
      closingModal,
      deleteOpen,
      modalOpen,
      openAbout,
      openDelete,
      openSettings,
      settingsOpen,
    ],
  );
}
