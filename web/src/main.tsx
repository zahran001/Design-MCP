import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { App } from './App.tsx';

// Dogfood the target: the whole SPA is built in Chakra UI v3 (defaultSystem is
// v3's batteries-included design system value for ChakraProvider).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
