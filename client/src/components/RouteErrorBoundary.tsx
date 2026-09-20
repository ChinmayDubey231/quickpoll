import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render errors in the routed page content so a crash there shows a
// visible message with a way to recover, instead of leaving the content area
// silently blank (React unmounts the tree on an uncaught render error, and
// there was nothing here to catch it or show that anything went wrong).
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 gap-4">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center border border-outline-variant">
            <span className="material-symbols-outlined text-3xl text-error">error</span>
          </div>
          <div>
            <h2 className="font-display font-bold text-on-surface text-lg mb-1">
              Something went wrong rendering this page
            </h2>
            <p className="text-sm text-on-surface-variant max-w-md font-mono break-words">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-primary-container text-on-primary-container font-display font-bold rounded-xl text-sm"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
