import React, { useState } from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import CabinetList from './CabinetList';
import PasswordTable from './PasswordTable';

const VaultPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [selectedCabinetId, setSelectedCabinetId] = useState<string | null>(null);

  const isAdmin = hasRole('Administrator');
  const canEdit = hasRole('Operator');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <LockOutlined style={{ marginRight: 8 }} />
          Password Vault
        </Typography.Title>
        <Typography.Text type="secondary">
          Shared team credentials — visible only to cabinet members
        </Typography.Text>
      </div>

      <Row gutter={16} style={{ height: 'calc(100vh - 200px)' }}>
        <Col flex="280px">
          <Card
            bodyStyle={{ padding: 0, height: '100%' }}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <CabinetList
              selectedId={selectedCabinetId}
              onSelect={setSelectedCabinetId}
              isAdmin={isAdmin}
            />
          </Card>
        </Col>

        <Col flex="1">
          <Card
            style={{ height: '100%', overflow: 'auto' }}
            bodyStyle={{ padding: 16 }}
          >
            {selectedCabinetId ? (
              <PasswordTable cabinetId={selectedCabinetId} canEdit={canEdit} />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bfbfbf',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <LockOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                  <Typography.Title level={5} type="secondary">
                    Select a cabinet to view entries
                  </Typography.Title>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VaultPage;
