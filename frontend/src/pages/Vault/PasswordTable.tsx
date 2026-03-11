import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LoadingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { passwordsApi } from '../../api/vault';
import type { PasswordEntry } from '../../types/vault';
import { useReveal } from './useReveal';
import PasswordEntryModal from './PasswordEntryModal';

interface Props {
  cabinetId: string;
  canEdit: boolean;
}

const PasswordTable: React.FC<Props> = ({ cabinetId, canEdit }) => {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);

  const { revealState, revealPassword, clearReveal, copyToClipboard } = useReveal();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await passwordsApi.list(cabinetId, page);
      setEntries(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      message.error(axiosErr.response?.data?.detail ?? 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [cabinetId, page]);

  useEffect(() => {
    setPage(1);
    clearReveal();
  }, [cabinetId, clearReveal]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await passwordsApi.delete(id);
      message.success('Entry deleted');
      fetchEntries();
    } catch {
      message.error('Failed to delete entry');
    }
  };

  const openCreate = (): void => {
    setEditEntry(null);
    setModalOpen(true);
  };

  const openEdit = (entry: PasswordEntry): void => {
    setEditEntry(entry);
    setModalOpen(true);
  };

  const isRevealing = (id: string): boolean =>
    revealState.loading && revealState.entryId === id;

  const isRevealed = (id: string): boolean =>
    !revealState.loading && revealState.entryId === id && revealState.password !== null;

  const columns: ColumnsType<PasswordEntry> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (val: string | null) =>
        val ? (
          <Space>
            <Typography.Text code>{val}</Typography.Text>
            <Tooltip title="Copy username">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(val)}
              />
            </Tooltip>
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (val: string | null) =>
        val ? (
          <Typography.Link href={val} target="_blank" rel="noopener noreferrer">
            {val.length > 40 ? `${val.slice(0, 40)}…` : val}
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags.length > 0 ? (
          tags.map((t) => <Tag key={t}>{t}</Tag>)
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Password',
      key: 'password',
      render: (_, record) => {
        if (isRevealing(record.id)) {
          return <LoadingOutlined />;
        }
        if (isRevealed(record.id)) {
          return (
            <Space>
              <Typography.Text code>{revealState.password}</Typography.Text>
              <Tooltip title="Copy password">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(revealState.password!)}
                />
              </Tooltip>
              <Tooltip title={`Clears in ${revealState.secondsLeft}s`}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeInvisibleOutlined />}
                  onClick={clearReveal}
                />
              </Tooltip>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {revealState.secondsLeft}s
              </Typography.Text>
            </Space>
          );
        }
        return (
          <Tooltip title="Reveal password (30s)">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => revealPassword(record.id)}
            >
              Reveal
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) =>
        canEdit ? (
          <Space>
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Delete this entry?"
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 12, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Entry
          </Button>
        </div>
      )}

      <Table
        rowKey="id"
        dataSource={entries}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 50,
          onChange: setPage,
          showTotal: (t) => `${t} entries`,
        }}
        size="small"
      />

      <PasswordEntryModal
        open={modalOpen}
        cabinetId={cabinetId}
        entry={editEntry}
        onClose={() => setModalOpen(false)}
        onSaved={fetchEntries}
      />
    </div>
  );
};

export default PasswordTable;
