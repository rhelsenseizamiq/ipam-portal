import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  Typography,
  Divider,
  message,
} from 'antd';
import dayjs from 'dayjs';
import type { Asset, AssetCreate, AssetUpdate } from '../../types/asset';
import { ASSET_TYPES, ASSET_STATUSES } from '../../types/asset';
import { assetsApi } from '../../api/assets';
import { ipRecordsApi } from '../../api/ipRecords';
import type { IPRecord } from '../../types/ipRecord';

const { Text } = Typography;

interface Props {
  open: boolean;
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}

interface IPRecordOption {
  value: string;
  label: string;
}

const AssetModal: React.FC<Props> = ({ open, asset, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [ipOptions, setIpOptions] = useState<IPRecordOption[]>([]);
  const [ipSearching, setIpSearching] = useState(false);

  const isEdit = asset !== null;

  useEffect(() => {
    if (open) {
      if (asset) {
        form.setFieldsValue({
          ...asset,
          warranty_expiry: asset.warranty_expiry ? dayjs(asset.warranty_expiry) : null,
        });
        if (asset.ip_record_id && asset.ip_address) {
          setIpOptions([{ value: asset.ip_record_id, label: asset.ip_address }]);
        }
      } else {
        form.resetFields();
        setIpOptions([]);
      }
    }
  }, [open, asset, form]);

  const handleIpSearch = async (query: string) => {
    if (query.length < 2) return;
    setIpSearching(true);
    try {
      const res = await ipRecordsApi.list({ search: query, page_size: 20 });
      const opts = res.data.items.map((r: IPRecord) => ({
        value: r.id,
        label: r.ip_address + (r.hostname ? ` (${r.hostname})` : ''),
      }));
      setIpOptions(opts);
    } catch {
      // non-critical
    } finally {
      setIpSearching(false);
    }
  };

  const handleSubmit = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSaving(true);
    try {
      const warranty = values.warranty_expiry
        ? (values.warranty_expiry as dayjs.Dayjs).format('YYYY-MM-DD')
        : null;

      if (isEdit && asset) {
        const update: AssetUpdate = { ...values, warranty_expiry: warranty } as AssetUpdate;
        await assetsApi.update(asset.id, update);
        message.success('Asset updated');
      } else {
        const create: AssetCreate = { ...values, warranty_expiry: warranty } as AssetCreate;
        await assetsApi.create(create);
        message.success('Asset created');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      message.error(axiosErr?.response?.data?.detail ?? 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Asset' : 'Add Asset'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText={isEdit ? 'Save' : 'Create'}
      confirmLoading={saving}
      width={680}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Text strong>Identity</Text>
        <Divider style={{ margin: '8px 0 16px' }} />
        <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]} style={{ flex: 2 }}>
            <Input placeholder="e.g. prod-web-01" />
          </Form.Item>
          <Form.Item name="asset_type" label="Type" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
            <Select placeholder="Select type" options={ASSET_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="Active" style={{ flex: 1 }}>
            <Select options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Space>

        <Text strong>Network</Text>
        <Divider style={{ margin: '8px 0 16px' }} />
        <Form.Item name="ip_record_id" label="Linked IP Record">
          <Select
            showSearch
            allowClear
            placeholder="Search IP address or hostname…"
            filterOption={false}
            onSearch={handleIpSearch}
            loading={ipSearching}
            options={ipOptions}
          />
        </Form.Item>
        <Form.Item name="hostname" label="Hostname">
          <Input placeholder="e.g. prod-web-01.example.com" />
        </Form.Item>

        <Text strong>Hardware</Text>
        <Divider style={{ margin: '8px 0 16px' }} />
        <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Form.Item name="vendor" label="Vendor" style={{ flex: 1 }}>
            <Input placeholder="e.g. Dell" />
          </Form.Item>
          <Form.Item name="model" label="Model" style={{ flex: 1 }}>
            <Input placeholder="e.g. PowerEdge R750" />
          </Form.Item>
          <Form.Item name="serial_number" label="Serial Number" style={{ flex: 1 }}>
            <Input placeholder="e.g. ABC1234567" />
          </Form.Item>
        </Space>
        <Form.Item name="os_version" label="OS / Firmware Version">
          <Input placeholder="e.g. Ubuntu 22.04 LTS" />
        </Form.Item>

        <Text strong>Location</Text>
        <Divider style={{ margin: '8px 0 16px' }} />
        <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Form.Item name="data_center" label="Data Center" style={{ flex: 1 }}>
            <Input placeholder="e.g. DC1" />
          </Form.Item>
          <Form.Item name="rack_location" label="Rack Location" style={{ flex: 1 }}>
            <Input placeholder="e.g. DC1-Row3-Rack12-U4" />
          </Form.Item>
        </Space>

        <Text strong>Other</Text>
        <Divider style={{ margin: '8px 0 16px' }} />
        <Form.Item name="warranty_expiry" label="Warranty Expiry">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="tags" label="Tags">
          <Select mode="tags" placeholder="Add tags…" />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} placeholder="Additional notes…" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AssetModal;
