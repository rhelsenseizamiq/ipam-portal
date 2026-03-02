import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Row,
  Col,
  message,
  Popconfirm,
  Typography,
  Progress,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { subnetsApi } from '../../api/subnets';
import { useAuth } from '../../context/AuthContext';
import type { SubnetDetail, SubnetCreate, SubnetUpdate } from '../../types/subnet';
import type { Environment } from '../../types/ipRecord';

const ENV_OPTIONS: Environment[] = ['Production', 'Test', 'Development'];

const ENV_COLOR: Record<Environment, string> = {
  Production: 'red',
  Test: 'orange',
  Development: 'cyan',
};

const PAGE_SIZE = 20;

const SubnetsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [subnets, setSubnets] = useState<SubnetDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<SubnetDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SubnetCreate & SubnetUpdate>();

  const fetchSubnets = useCallback(async (page: number): Promise<void> => {
    setLoading(true);
    try {
      const res = await subnetsApi.list({ page, page_size: PAGE_SIZE });
      setSubnets(res.data.items);
      setTotal(res.data.total);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(
        axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Failed to load subnets'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubnets(currentPage);
  }, [fetchSubnets, currentPage]);

  const handleTableChange = useCallback((pagination: TablePaginationConfig): void => {
    setCurrentPage(pagination.current ?? 1);
  }, []);

  const openCreate = useCallback((): void => {
    setEditingSubnet(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (subnet: SubnetDetail): void => {
      setEditingSubnet(subnet);
      form.setFieldsValue({
        cidr: subnet.cidr,
        name: subnet.name,
        description: subnet.description ?? undefined,
        gateway: subnet.gateway ?? undefined,
        vlan_id: subnet.vlan_id ?? undefined,
        environment: subnet.environment,
      });
      setModalOpen(true);
    },
    [form]
  );

  const handleSubmit = useCallback(
    async (values: SubnetCreate & SubnetUpdate): Promise<void> => {
      setSubmitting(true);
      try {
        if (editingSubnet) {
          const update: SubnetUpdate = {
            name: values.name,
            description: values.description,
            gateway: values.gateway,
            vlan_id: values.vlan_id,
            environment: values.environment,
          };
          await subnetsApi.update(editingSubnet.id, update);
          message.success('Subnet updated');
        } else {
          const create: SubnetCreate = {
            cidr: values.cidr!,
            name: values.name!,
            description: values.description,
            gateway: values.gateway,
            vlan_id: values.vlan_id,
            environment: values.environment!,
          };
          await subnetsApi.create(create);
          message.success('Subnet created');
        }
        setModalOpen(false);
        form.resetFields();
        void fetchSubnets(currentPage);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
        message.error(
          axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Operation failed'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [editingSubnet, currentPage, fetchSubnets, form]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      try {
        await subnetsApi.delete(id);
        message.success('Subnet deleted');
        void fetchSubnets(currentPage);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
        message.error(
          axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Delete failed'
        );
      }
    },
    [currentPage, fetchSubnets]
  );

  const columns: ColumnsType<SubnetDetail> = [
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
      render: (v: Environment) => <Tag color={ENV_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'VLAN',
      dataIndex: 'vlan_id',
      key: 'vlan_id',
      width: 80,
      render: (v: number | null) =>
        v != null ? (
          v
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Gateway',
      dataIndex: 'gateway',
      key: 'gateway',
      width: 140,
      render: (v: string | null) =>
        v ? (
          <Typography.Text code>{v}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Utilization',
      key: 'utilization',
      width: 240,
      render: (_, record) => {
        const pct =
          record.total_ips > 0
            ? Math.round((record.used_ips / record.total_ips) * 100)
            : 0;
        const strokeColor =
          pct >= 90 ? '#ff4d4f' : pct >= 70 ? '#faad14' : '#52c41a';
        return (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 2,
                fontSize: 12,
              }}
            >
              <Typography.Text type="secondary">
                {record.used_ips} / {record.total_ips}
              </Typography.Text>
              <Typography.Text style={{ color: strokeColor }}>{pct}%</Typography.Text>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor={strokeColor}
              size="small"
            />
          </div>
        );
      },
    },
    ...(hasRole('Administrator')
      ? ([
          {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_: unknown, record: SubnetDetail) => (
              <Space size={4}>
                <Tooltip title="Edit">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Delete this subnet?"
                  description="This will only succeed if no IP records are assigned."
                  onConfirm={() => void handleDelete(record.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Tooltip title="Delete">
                    <Button size="small" icon={<DeleteOutlined />} danger />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ] as ColumnsType<SubnetDetail>)
      : []),
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
          Subnets
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void fetchSubnets(currentPage)}
            loading={loading}
          >
            Refresh
          </Button>
          {hasRole('Administrator') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Create Subnet
            </Button>
          )}
        </Space>
      </div>

      <Table<SubnetDetail>
        dataSource={subnets}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `${t} subnets`,
        }}
        onChange={handleTableChange}
        size="small"
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: '8px 0' }}>
              <Space size={24}>
                <span>
                  <Typography.Text type="secondary">Free: </Typography.Text>
                  <Typography.Text style={{ color: '#52c41a' }}>
                    {record.free_ips}
                  </Typography.Text>
                </span>
                <span>
                  <Typography.Text type="secondary">Reserved: </Typography.Text>
                  <Typography.Text style={{ color: '#fa8c16' }}>
                    {record.reserved_ips}
                  </Typography.Text>
                </span>
                <span>
                  <Typography.Text type="secondary">In Use: </Typography.Text>
                  <Typography.Text style={{ color: '#1677ff' }}>
                    {record.used_ips}
                  </Typography.Text>
                </span>
                {record.description && (
                  <span>
                    <Typography.Text type="secondary">Description: </Typography.Text>
                    <Typography.Text>{record.description}</Typography.Text>
                  </span>
                )}
              </Space>
            </div>
          ),
        }}
      />

      <Modal
        title={editingSubnet ? 'Edit Subnet' : 'Create Subnet'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editingSubnet ? 'Save' : 'Create'}
        confirmLoading={submitting}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void handleSubmit(values)}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="CIDR"
            name="cidr"
            rules={[
              { required: true, message: 'CIDR is required' },
              {
                pattern: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
                message: 'Enter a valid CIDR (e.g. 192.168.1.0/24)',
              },
            ]}
          >
            <Input placeholder="192.168.1.0/24" disabled={!!editingSubnet} />
          </Form.Item>

          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="Office LAN" />
          </Form.Item>

          <Form.Item
            label="Environment"
            name="environment"
            rules={[{ required: true, message: 'Environment is required' }]}
          >
            <Select>
              {ENV_OPTIONS.map((e) => (
                <Select.Option key={e} value={e}>
                  {e}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Gateway" name="gateway">
                <Input placeholder="192.168.1.1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="VLAN ID" name="vlan_id">
                <InputNumber
                  min={1}
                  max={4094}
                  style={{ width: '100%' }}
                  placeholder="100"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SubnetsPage;
