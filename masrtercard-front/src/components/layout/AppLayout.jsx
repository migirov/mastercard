import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import ErrorBoundary from './ErrorBoundary';

export default function AppLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <MobileHeader />
        <main className="flex-1 overflow-auto">
          {/* Keyed on the pathname so navigating to another page remounts a clean boundary —
              a crash on one page must not wedge the rest of the app. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}