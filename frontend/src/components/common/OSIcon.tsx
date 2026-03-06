import React from 'react';
import { WindowsOutlined, QuestionOutlined } from '@ant-design/icons';
import type { OSType } from '../../types/ipRecord';

interface Props {
  osType: OSType;
}

const LinuxIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ verticalAlign: '-0.15em', marginRight: 4, color: '#333' }}
    aria-hidden="true"
  >
    <path d="M12 2C9.24 2 7 4.24 7 7c0 1.5.57 2.86 1.5 3.87-.55.8-.5 1.8.13 2.55.5.59 1.22.94 1.97.97L10.5 16h3l-.1-1.61c.75-.03 1.47-.38 1.97-.97.63-.75.68-1.75.13-2.55C16.43 9.86 17 8.5 17 7c0-2.76-2.24-5-5-5zm-1.25 5.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm2.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM9 18c0 1.66 1.34 3 3 3s3-1.34 3-3v-1H9v1z" />
  </svg>
);

const AixIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ verticalAlign: '-0.15em', marginRight: 4, color: '#1f4e8c' }}
    aria-hidden="true"
  >
    <path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 4H4V5h16v2zm0 4H4V9h16v2zm0 4H4v-2h16v2zm-3 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0-4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0-4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
  </svg>
);

const MacOSIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ verticalAlign: '-0.15em', marginRight: 4, color: '#555' }}
    aria-hidden="true"
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const OpenShiftIcon: React.FC = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ verticalAlign: '-0.15em', marginRight: 4, color: '#ee0000' }}
    aria-hidden="true"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
  </svg>
);

const OSIcon: React.FC<Props> = ({ osType }) => {
  if (osType === 'Windows') {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <WindowsOutlined style={{ marginRight: 4, color: '#00adef' }} />
        {osType}
      </span>
    );
  }
  if (osType === 'Linux') {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <LinuxIcon />
        {osType}
      </span>
    );
  }
  if (osType === 'macOS') {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <MacOSIcon />
        {osType}
      </span>
    );
  }
  if (osType === 'OpenShift') {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <OpenShiftIcon />
        {osType}
      </span>
    );
  }
  if (osType === 'Unknown') {
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <QuestionOutlined style={{ marginRight: 4, color: '#aaa' }} />
        {osType}
      </span>
    );
  }
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <AixIcon />
      {osType}
    </span>
  );
};

export default OSIcon;
