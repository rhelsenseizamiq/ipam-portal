import React from 'react';
import type { OSType } from '../../types/ipRecord';

interface Props {
  osType: OSType;
}

const OS_EMOJI: Record<OSType, string> = {
  AIX: '\uD83D\uDDA5',
  Linux: '\uD83D\uDC27',
  Windows: '\uD83E\uDEDF',
};

const OSIcon: React.FC<Props> = ({ osType }) => (
  <span style={{ whiteSpace: 'nowrap' }}>
    <span role="img" aria-label={osType} style={{ marginRight: 4 }}>
      {OS_EMOJI[osType]}
    </span>
    {osType}
  </span>
);

export default OSIcon;
