import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';

/**
 * PublicLayout - Wraps all public-facing pages.
 * Renders TopNavbar (Header) + page content (Outlet) + Footer.
 */
const PublicLayout = () => {
  return (
    <div className="public-layout flex flex-col min-h-screen bg-background text-on-surface font-body-md">
      <Header />
      <main className="main-content flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
