import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Popconfirm,
  Input,
  Typography,
  message,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { usersApi } from '../../api/users';
import type { User } from '../../types/user';
import ApproveModal from './ApproveModal';

const { TextArea } = Input;
const { Title } = Typography;

const PendingApprovalsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<User | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.pending({ page, page_size: pageSize });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleReject = async (user: User): Promise<void> => {
    try {
      await usersApi.reject(user.id, { reason: rejectReasons[user.id] || undefined });
      message.success(`Rejected registration for ${user.username}`);
      void fetchPending();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const detail = axiosErr?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : 'Reject failed');
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 160,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Note',
      dataIndex: 'registration_note',
      key: 'registration_note',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (v.length > 80 ? `${v.slice(0, 80)}…` : v) : '—',
    },
    {
      title: 'Requested At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => setApproveTarget(record)}
          >
            Approve
          </Button>

          <Popconfirm
            title="Reject this registration?"
            description={
              <TextArea
                placeholder="Reason (optional)"
                maxLength={500}
                rows={2}
                style={{ width: 260, marginTop: 4 }}
                value={rejectReasons[record.id] ?? ''}
                onChange={(e) =>
                  setRejectReasons((prev) => ({ ...prev, [record.id]: e.target.value }))
                }
              />
            }
            okText="Reject"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleReject(record)}
            cancelText="Cancel"
          >
            <Button danger size="small">
              Reject
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        Pending Approvals
      </Title>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        locale={{ emptyText: <Empty description="No pending registrations" /> }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `${t} pending`,
        }}
      />

      <ApproveModal
        user={approveTarget}
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onApproved={() => {
          setApproveTarget(null);
          void fetchPending();
        }}
      />
    </div>
  );
};

export default PendingApprovalsPage;
