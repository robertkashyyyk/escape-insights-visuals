import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render-time crashes so a page shows the actual error instead of a
 *  blank/black screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <h1 className="text-xl font-bold mb-2">Something went wrong on this page</h1>
          <p className="text-sm text-muted-foreground mb-4">
            It hit an error and couldn't render. The details are below — send them over and we'll fix it.
          </p>
          <pre className="text-xs bg-card border border-border rounded-lg p-3 overflow-auto max-h-[50vh] whitespace-pre-wrap">
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); if (typeof location !== "undefined") location.reload(); }}
            className="mt-3 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
