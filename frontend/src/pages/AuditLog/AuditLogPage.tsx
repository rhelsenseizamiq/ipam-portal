import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Select,
  Input,
  DatePicker,
  Tag,
  Typography,
  message,
  Row,
  Col,
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { auditLogsApi } from '../../api/auditLogs';
import type { AuditLog, AuditAction, AuditLogFilters, ResourceType } from '../../types/auditLog';

const { RangePicker } = DatePicker;

const ACTION_OPTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESERVE',
  'RELEASE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_RESET',
];

const RESOURCE_OPTIONS: ResourceType[] = ['ip_record', 'subnet', 'user', 'auth'];

const ACTION_COLOR: Record<AuditAction, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  RESERVE: 'orange',
  RELEASE: 'cyan',
  LOGIN: 'purple',
  LOGOUT: 'default',
  LOGIN_FAILED: 'error',
  PASSWORD_RESET: 'geekblue',
};

const PAGE_SIZE = 25;

const JsonDisplay: React.FC<{ data: Record<string, unknown> | null; label: string }> = ({
  data,
  label,
}) => {
  if (!data) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Typography.Text>
      <pre
        style={{
          fontSize: 11,
          background: '#f5f5f5',
          padding: '6px 8px',
          borderRadius: 4,
          maxHeight: 200,
          overflow: 'auto',
          margin: '4px 0 0',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [usernameFilter, setUsernameFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | undefined>(undefined);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceType | undefined>(
    undefined
  );
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const buildFilters = useCallback((): AuditLogFilters => {
    const filters: AuditLogFilters = {
      page: currentPage,
      page_size: PAGE_SIZE,
    };
    if (usernameFilter) filters.username = usernameFilter;
    if (actionFilter) filters.action = actionFilter;
    if (resourceTypeFilter) filters.resource_type = resourceTypeFilter;
    if (dateRange?.[0]) filters.date_from = dateRange[0].toISOString();
    if (dateRange?.[1]) filters.date_to = dateRange[1].endOf('day').toISOString();
    return filters;
  }, [currentPage, usernameFilter, actionFilter, resourceTypeFilter, dateRange]);

  const fetchLogs = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await auditLogsApi.list(buildFilters());
      setLogs(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(
        axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Failed to load audit logs'
      );
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleTableChange = useCallback((pagination: TablePaginationConfig): void => {
    setCurrentPage(pagination.current ?? 1);
  }, []);

  const handleSearch = useCallback((): void => {
    setCurrentPage(1);
  }, []);

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v: string) => (
        <Typography.Text style={{ fontSize: 12 }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm:ss')}
        </Typography.Text>
      ),
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Role',
      dataIndex: 'user_role',
      key: 'user_role',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (v: AuditAction) => <Tag color={ACTION_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Resource Type',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: 'Resource ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 130,
      render: (v: string | null) =>
        v ? (
          <Typography.Text
            copyable={{ text: v }}
            style={{ fontSize: 11, fontFamily: 'monospace' }}
          >
            {v.length > 16 ? `${v.slice(0, 8)}...` : v}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Client IP',
      dataIndex: 'client_ip',
      key: 'client_ip',
      width: 130,
      render: (v: string) => <Typography.Text code style={{ fontSize: 11 }}>{v}</Typography.Text>,
    },
    {
      title: 'Detail',
      dataIndex: 'detail',
      key: 'detail',
      render: (v: string | null) =>
        v ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Audit Log
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => void fetchLogs()} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <RangePicker
            style={{ width: '100%' }}
            onChange={(range) =>
              setDateRange(range as [Dayjs | null, Dayjs | null] | null)
            }
            allowClear
          />
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            placeholder="Action"
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => setActionFilter(v as AuditAction | undefined)}
          >
            {ACTION_OPTIONS.map((a) => (
              <Select.Option key={a} value={a}>
                <Tag color={ACTION_COLOR[a]}>{a}</Tag>
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            placeholder="Resource Type"
            allowClear
            style={{ width: '100%' }}
            onChange={(v) => setResourceTypeFilter(v as ResourceType | undefined)}
          >
            {RESOURCE_OPTIONS.map((r) => (
              <Select.Option key={r} value={r}>
                {r}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col xs={18} sm={8} md={5}>
          <Input
            placeholder="Filter by username"
            prefix={<SearchOutlined />}
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            onClear={() => setUsernameFilter('')}
          />
        </Col>
        <Col xs={6} sm={4} md={3}>
          <Button type="primary" onClick={handleSearch} block>
            Search
          </Button>
        </Col>
      </Row>

      <Table<AuditLog>
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `${t} events`,
        }}
        onChange={handleTableChange}
        size="small"
        expandable={{
          expandedRowRender: (record) => (
            <Row gutter={24} style={{ padding: '8px 0' }}>
              <Col span={12}>
                <JsonDisplay data={record.before} label="Before" />
              </Col>
              <Col span={12}>
                <JsonDisplay data={record.after} label="After" />
              </Col>
            </Row>
          ),
          rowExpandable: (record) => !!(record.before || record.after),
        }}
      />
    </div>
  );
};

export default AuditLogPage;
