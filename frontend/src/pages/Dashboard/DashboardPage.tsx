import React, { useEffect, useState, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Table,
  Typography,
  Spin,
  message,
} from 'antd';
import {
  GlobalOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ipRecordsApi } from '../../api/ipRecords';
import { subnetsApi } from '../../api/subnets';
import type { SubnetDetail } from '../../types/subnet';

interface DashboardStats {
  total: number;
  free: number;
  reserved: number;
  inUse: number;
  aixCount: number;
  linuxCount: number;
  windowsCount: number;
}

const EMPTY_STATS: DashboardStats = {
  total: 0,
  free: 0,
  reserved: 0,
  inUse: 0,
  aixCount: 0,
  linuxCount: 0,
  windowsCount: 0,
};

const subnetColumns: ColumnsType<SubnetDetail> = [
  {
    title: 'CIDR',
    dataIndex: 'cidr',
    key: 'cidr',
    width: 160,
    render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Environment',
    dataIndex: 'environment',
    key: 'environment',
    width: 120,
  },
  {
    title: 'Utilization',
    key: 'utilization',
    width: 260,
    render: (_, record) => {
      const pct =
        record.total_ips > 0
          ? Math.round((record.used_ips / record.total_ips) * 100)
          : 0;
      const color = pct >= 90 ? '#ff4d4f' : pct >= 70 ? '#faad14' : '#52c41a';
      return (
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.used_ips} / {record.total_ips}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 12, color }}>{pct}%</Typography.Text>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            strokeColor={color}
            size="small"
          />
        </div>
      );
    },
  },
  {
    title: 'Free',
    dataIndex: 'free_ips',
    key: 'free_ips',
    width: 80,
    align: 'right',
    render: (v: number) => <Typography.Text style={{ color: '#52c41a' }}>{v}</Typography.Text>,
  },
];

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [subnets, setSubnets] = useState<SubnetDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Fetch overview counts by loading small pages per status
      const [allRes, freeRes, reservedRes, inUseRes, aixRes, linuxRes, windowsRes, subnetsRes] =
        await Promise.all([
          ipRecordsApi.list({ page: 1, page_size: 1 }),
          ipRecordsApi.list({ page: 1, page_size: 1, status: 'Free' }),
          ipRecordsApi.list({ page: 1, page_size: 1, status: 'Reserved' }),
          ipRecordsApi.list({ page: 1, page_size: 1, status: 'In Use' }),
          ipRecordsApi.list({ page: 1, page_size: 1, os_type: 'AIX' }),
          ipRecordsApi.list({ page: 1, page_size: 1, os_type: 'Linux' }),
          ipRecordsApi.list({ page: 1, page_size: 1, os_type: 'Windows' }),
          subnetsApi.list({ page_size: 50 }),
        ]);

      setStats({
        total: allRes.data.total,
        free: freeRes.data.total,
        reserved: reservedRes.data.total,
        inUse: inUseRes.data.total,
        aixCount: aixRes.data.total,
        linuxCount: linuxRes.data.total,
        windowsCount: windowsRes.data.total,
      });
      setSubnets(subnetsRes.data.items);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const osTotal = stats.aixCount + stats.linuxCount + stats.windowsCount || 1;
  const osPct = (count: number): number => Math.round((count / osTotal) * 100);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Dashboard
      </Typography.Title>

      {/* Summary statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total IP Records"
              value={stats.total}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Free"
              value={stats.free}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Reserved"
              value={stats.reserved}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="In Use"
              value={stats.inUse}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* OS breakdown */}
        <Col xs={24} lg={8}>
          <Card title="OS Type Breakdown" style={{ height: '100%' }}>
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Typography.Text>
                    <span role="img" aria-label="AIX">
                      🖥
                    </span>{' '}
                    AIX
                  </Typography.Text>
                  <Typography.Text type="secondary">{stats.aixCount}</Typography.Text>
                </div>
                <Progress
                  percent={osPct(stats.aixCount)}
                  strokeColor="#722ed1"
                  format={(p) => `${p ?? 0}%`}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Typography.Text>
                    <span role="img" aria-label="Linux">
                      🐧
                    </span>{' '}
                    Linux
                  </Typography.Text>
                  <Typography.Text type="secondary">{stats.linuxCount}</Typography.Text>
                </div>
                <Progress
                  percent={osPct(stats.linuxCount)}
                  strokeColor="#52c41a"
                  format={(p) => `${p ?? 0}%`}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Typography.Text>
                    <span role="img" aria-label="Windows">
                      🪟
                    </span>{' '}
                    Windows
                  </Typography.Text>
                  <Typography.Text type="secondary">{stats.windowsCount}</Typography.Text>
                </div>
                <Progress
                  percent={osPct(stats.windowsCount)}
                  strokeColor="#1677ff"
                  format={(p) => `${p ?? 0}%`}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Subnet utilization */}
        <Col xs={24} lg={16}>
          <Card title="Subnet Utilization">
            <Table<SubnetDetail>
              dataSource={subnets}
              columns={subnetColumns}
              rowKey="id"
              pagination={subnets.length > 10 ? { pageSize: 10 } : false}
              size="small"
              locale={{ emptyText: 'No subnets configured' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
