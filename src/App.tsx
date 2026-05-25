/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LandingPage } from './pages/LandingPage';
import { JudgementPage } from './pages/JudgementPage';
import { LocationResult } from './types';

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);

  return (
    <>
      {!selectedLocation ? (
        <LandingPage onLocationSelected={setSelectedLocation} />
      ) : (
        <JudgementPage 
          location={selectedLocation} 
          onReset={() => setSelectedLocation(null)} 
        />
      )}
    </>
  );
}

