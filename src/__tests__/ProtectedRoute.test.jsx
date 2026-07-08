import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';

// Mock axios since AuthContext uses it
jest.mock('axios');

describe('ProtectedRoute', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const TestWrapper = ({ children }) => (
    <MemoryRouter initialEntries={['/protected']}>
      <AuthProvider>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute>{children}</ProtectedRoute>} />
          <Route path="/login" element={<div>Login Page Redirected</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

  it('renders children when /api/auth/me returns 200', async () => {
    axios.get.mockResolvedValueOnce({
      data: { success: true, data: { user: { id: 1, email: 'test@test.com' } } }
    });

    render(
      <TestWrapper>
        <div>Protected Content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('redirects to /login when /api/auth/me returns 401', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    render(
      <TestWrapper>
        <div>Protected Content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Redirected')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
