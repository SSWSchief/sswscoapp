"use client";

import * as React from "react";

export interface DriverShellContextValue {
  dark: boolean;
  toggle: () => void;
  openMenu: () => void;
  openNotifications: () => void;
  unreadCount: number;
}

export const DriverShellContext = React.createContext<DriverShellContextValue>({
  dark: false,
  toggle: () => {},
  openMenu: () => {},
  openNotifications: () => {},
  unreadCount: 0,
});

export const useDriverTheme = () => React.useContext(DriverShellContext);
