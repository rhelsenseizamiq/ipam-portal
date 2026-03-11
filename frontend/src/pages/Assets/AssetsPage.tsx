import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
  message,
  theme,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Asset, AssetStatus, AssetType } from '../../types/asset';
import { ASSET_TYPES, ASSET_STATUSES } from '../../types/asset';
import { assetsApi } from '../../api/assets';
import { useAuth } from '../../context/AuthContext';
import AssetModal from './AssetModal';

const { Title } = Typography;

const STATUS_COLOR: Record<AssetStatus, string> = {
  Active: 'success',
  Inactive: 'default',
  Maintenance: 'warning',
  Decommissioned: 'error',
};

const TYPE_COLOR: Record<AssetType, string> = {
  Server: 'blue',
  Switch: 'cyan',
  Router: 'geekblue',
  Firewall: 'red',
  'Load Balancer': 'purple',
  Storage: 'gold',
  'Virtual Machine': 'lime',
  Other: 'default',
};

function isWarrantyWarning(expiry: string | null): boolean {
  if (!expiry) return false;
  const days = dayjs(expiry).diff(dayjs(), 'day');
  return days <= 30;
}

const AssetsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const { token } = theme.useToken();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AssetType | undefined>();
  const [filterStatus, setFilterStatus] = useState<AssetStatus | undefined>();
  const [filterDC, setFilterDC] = useState<string | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetsApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        asset_type: filterType,
        status: filterStatus,
        data_center: filterDC || undefined,
      });
      setAssets(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterType, filterStatus, filterDC]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDelete = async (id: string) => {
    try {
      await assetsApi.delete(id);
      message.success('Asset deleted');
      fetchAssets();
    } catch {
      message.error('Failed to delete asset');
    }
  };

  const openCreate = () => {
    setEditingAsset(null);
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setModalOpen(true);
  };

  const columns: ColumnsType<Asset> = [
    {
      title: 'Type',
      dataIndex: 'asset_type',
      width: 120,
      render: (type: AssetType) => (
        <Tag color={TYPE_COLOR[type] ?? 'default'}>{type}</Tag>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Vendor / Model',
      render: (_: unknown, r: Asset) => {
        const parts = [r.vendor, r.model].filter(Boolean).join(' / ');
        return parts || '—';
      },
    },
    {
      title: 'Data Center',
      dataIndex: 'data_center',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Rack',
      dataIndex: 'rack_location',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: AssetStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: 'Warranty',
      dataIndex: 'warranty_expiry',
      width: 120,
      render: (v: string | null) => {
        if (!v) return '—';
        const warning = isWarrantyWarning(v);
        const expired = dayjs(v).isBefore(dayjs(), 'day');
        const color = expired || warning ? token.colorError : undefined;
        return (
          <span style={{ color }}>
            {expired || warning ? <WarningOutlined style={{ marginRight: 4 }} /> : null}
            {dayjs(v).format('YYYY-MM-DD')}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      width: 80,
      render: (_: unknown, record: Asset) => (
        <Space>
          {hasRole('Operator') && (
            <Tooltip title="Edit">
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {hasRole('Administrator') && (
            <Popconfirm
              title="Delete this asset?"
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okType="danger"
            >
              <Tooltip title="Delete">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Asset Inventory
        </Title>
        {hasRole('Operator') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Asset
          </Button>
        )}
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search name, hostname, serial…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="Type"
          allowClear
          value={filterType}
          onChange={(v) => { setFilterType(v); setPage(1); }}
          style={{ width: 160 }}
          options={ASSET_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <Select
          placeholder="Status"
          allowClear
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v); setPage(1); }}
          style={{ width: 150 }}
          options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Input
          placeholder="Data Center"
          value={filterDC ?? ''}
          onChange={(e) => { setFilterDC(e.target.value || undefined); setPage(1); }}
          allowClear
          style={{ width: 150 }}
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={assets}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `${t} assets`,
          onChange: setPage,
        }}
        size="small"
      />

      <AssetModal
        open={modalOpen}
        asset={editingAsset}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAssets}
      />
    </div>
  );
};

export default AssetsPage;
