import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundView: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0c] px-4 text-center">
      <h1 className="text-9xl font-black text-purple-600/20">404</h1>
      <h2 className="mt-4 text-2xl font-bold text-white">Page Not Found</h2>
      <p className="mt-2 text-sm text-[#9c9cb0]">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
      >
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFoundView;
