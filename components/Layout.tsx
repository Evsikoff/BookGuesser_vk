
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center py-3 sm:py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-3 sm:mb-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-bold text-stone-800 mb-1 sm:mb-2 tracking-tight serif">
          Book Guesser <span className="text-amber-700 italic">Royale</span>
        </h1>
        <p className="text-stone-600 font-medium">Узнайте шедевр по одному лишь шепоту текста.</p>
      </header>
      <main className="w-full max-w-4xl">
        {children}
      </main>
      <footer className="mt-auto pt-8 text-stone-400 text-sm">
         
      </footer>
    </div>
  );
};
