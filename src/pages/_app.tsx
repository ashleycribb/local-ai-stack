import React from 'react';
import { AppProps } from 'next/app';
import { ModelProvider } from '../contexts/ModelContext'; // Adjust path as needed
import '../styles/globals.css'; // Assuming you have a global CSS file

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ModelProvider>
      <Component {...pageProps} />
    </ModelProvider>
  );
}

export default MyApp;
