import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { DatabaseOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface PortalCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const PORTALS: PortalCard[] = [
  {
    title: 'IPAM Portal',
    description: 'Manage IP addresses, subnets, VRFs, and aggregates across your network.',
    icon: <DatabaseOutlined style={{ fontSize: 48 }} />,
    path: '/dashboard',
    color: '#1677ff',
  },
  {
    title: 'Password Manager',
    description: 'Shared team credential cabinets with per-cabinet encrypted storage.',
    icon: <LockOutlined style={{ fontSize: 48 }} />,
    path: '/vault',
    color: '#52c41a',
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #001529 0%, #003366 100%)',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 800 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title style={{ color: '#fff', margin: 0 }} level={2}>
            Portal Home
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>
            Select a portal to continue
          </Text>
        </div>

        <Row gutter={24} justify="center">
          {PORTALS.map((portal) => (
            <Col key={portal.path} xs={24} sm={12}>
              <Card
                hoverable
                onClick={() => navigate(portal.path)}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: 12,
                  border: `2px solid transparent`,
                  transition: 'border-color 0.2s',
                }}
                styles={{ body: { padding: '40px 24px' } }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = portal.color;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                }}
              >
                <div style={{ color: portal.color, marginBottom: 16 }}>{portal.icon}</div>
                <Title level={4} style={{ margin: '0 0 8px' }}>
                  {portal.title}
                </Title>
                <Text type="secondary">{portal.description}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default HomePage;
