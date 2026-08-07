"use client";

import * as React from "react";

interface DispatcherUI {
  openDrawer: () => void;
  openCommand: () => void;
  openNotifications: () => void;
  unreadCount: number;
}

export const DispatcherUIContext = React.createContext<DispatcherUI | null>(
  null,
);

export function useDispatcherUI(): DispatcherUI {
  return (
    React.useContext(DispatcherUIContext) ?? {
      openDrawer: () => {},
      openCommand: () => {},
      openNotifications: () => {},
      unreadCount: 0,
    }
  );
}
