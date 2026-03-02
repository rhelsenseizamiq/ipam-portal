import React, { useMemo } from 'react';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  GlobalOutlined,
  ApartmentOutlined,
  TeamOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface Props {
  collapsed: boolean;
}

const Sidebar: React.FC<Props> = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/ip-records')) return '/ip-records';
    if (path.startsWith('/subnets')) return '/subnets';
    if (path.startsWith('/users')) return '/users';
    if (path.startsWith('/audit-log')) return '/audit-log';
    return '/dashboard';
  }, [location.pathname]);

  const menuItems = useMemo(() => {
    const items = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
      },
      {
        key: '/ip-records',
        icon: <GlobalOutlined />,
        label: 'IP Records',
      },
      {
        key: '/subnets',
        icon: <ApartmentOutlined />,
        label: 'Subnets',
      },
    ];

    if (hasRole('Administrator')) {
      items.push(
        {
          key: '/users',
          icon: <TeamOutlined />,
          label: 'Users',
        },
        {
          key: '/audit-log',
          icon: <AuditOutlined />,
          label: 'Audit Log',
        }
      );
    }

    return items;
  }, [hasRole]);

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      inlineCollapsed={collapsed}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ borderRight: 0, flex: 1 }}
    />
  );
};

export default Sidebar;
