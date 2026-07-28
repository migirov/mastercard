import React from 'react';

/**
 * Catches render-phase errors from the page tree so one malformed record cannot white-screen
 * the whole SPA. React 18's `createRoot` unmounts the ENTIRE tree on an uncaught render error,
 * and there is no other boundary in the app — the entity store is an open, shared-token
 * free-for-all, so every stored string the UI renders is effectively untrusted input, and a
 * single bad field (e.g. `invoice_details` arriving as a string, or a `status` equal to a
 * prototype key) would otherwise blank the whole app for every operator.
 *
 * Scoped around `<Outlet/>` (see AppLayout, keyed on the pathname so navigation resets it):
 * a page crash degrades to this fallback while the sidebar and header stay alive and navigable.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Visible in the console for diagnosis; this app has no telemetry, so nothing is sent out.
    // eslint-disable-next-line no-console
    console.error('Render error caught by ErrorBoundary:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md space-y-3 text-center">
            <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
            <p className="text-sm text-muted-foreground">
              A problem while displaying this data stopped the page from rendering. Other pages
              are unaffected — use the menu to navigate, or try again.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
