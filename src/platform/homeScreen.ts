export interface HomeScreenDevice {
  userAgent: string; platform: string; touchPoints: number;
  standalone: boolean; displayModeStandalone: boolean;
}
/** iPadOS can identify itself as a Mac, but still reports touch points. */
export function shouldSuggestHomeScreen(device: HomeScreenDevice): boolean {
  const ios = /iPhone|iPod|iPad/i.test(device.userAgent) || /iPhone|iPod|iPad/i.test(device.platform)
    || /Mac/i.test(device.platform) && device.touchPoints > 0;
  return ios && !device.standalone && !device.displayModeStandalone;
}
export function homeScreenPromptNeeded(): boolean {
  try {
    let displayModeStandalone = false;
    try { displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false; } catch { /* Optional media query. */ }
    return shouldSuggestHomeScreen({ userAgent: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints ?? 0,
      standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true, displayModeStandalone });
  } catch { return false; }
}
