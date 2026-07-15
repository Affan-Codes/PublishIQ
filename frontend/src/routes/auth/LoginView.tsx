import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useNotifications } from '../../context/NotificationContext.js';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { addToast } = useNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      addToast('Successfully signed in as operator', 'success');
      navigate('/');
    } catch (err: any) {
      addToast(err.message || 'Login failed. Please verify credentials.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0c] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12]/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">PublishIQ</h1>
          <p className="mt-2 text-sm text-[#9c9cb0]">Sign in to the operator dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
              Operator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@publishiq.com"
              className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-3 text-sm text-white placeholder-[#6e6e80] outline-none transition focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-3 text-sm text-white placeholder-[#6e6e80] outline-none transition focus:border-purple-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:bg-purple-600/50"
          >
            {isSubmitting ? 'Verifying...' : 'Sign In as Operator'}
          </button>
        </form>

        <div className="mt-8 border-t border-[#1a1a24] pt-6 text-center">
          <p className="text-xs text-[#6e6e80]">
            System configured for single-operator access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
