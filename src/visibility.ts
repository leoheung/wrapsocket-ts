type VisibilityCallback = (visible: boolean) => void;

export class VisibilityMonitor {
  private callback: VisibilityCallback | null = null;
  private isMonitoring = false;

  get isVisible(): boolean {
    if (typeof document !== "undefined") {
      return document.visibilityState === "visible";
    }
    return true;
  }

  get isHidden(): boolean {
    return !this.isVisible;
  }

  start(callback: VisibilityCallback): void {
    if (this.isMonitoring || typeof document === "undefined") {
      return;
    }

    this.callback = callback;
    this.isMonitoring = true;

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  stop(): void {
    if (!this.isMonitoring || typeof document === "undefined") {
      return;
    }

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    this.isMonitoring = false;
    this.callback = null;
  }

  private handleVisibilityChange = (): void => {
    const visible = this.isVisible;
    this.callback?.(visible);
  };
}
