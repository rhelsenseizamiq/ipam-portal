import React from 'react';
import { Tag } from 'antd';
import type { IPStatus } from '../../types/ipRecord';

interface Props {
  status: IPStatus;
}

const STATUS_COLOR: Record<IPStatus, string> = {
  Free: 'green',
  Reserved: 'orange',
  'In Use': 'blue',
};

const StatusBadge: React.FC<Props> = ({ status }) => (
  <Tag color={STATUS_COLOR[status]}>{status}</Tag>
);

export default StatusBadge;
