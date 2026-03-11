import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, Typography, message } from 'antd';
import { cabinetsApi } from '../../api/vault';
import { usersApi } from '../../api/users';
import type { User } from '../../types/user';
import type { Cabinet } from '../../types/vault';

interface Props {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onApproved: () => void;
}

const ROLE_OPTIONS = [
  { label: 'Viewer', value: 'Viewer' },
  { label: 'Operator', value: 'Operator' },
  { label: 'Administrator', value: 'Administrator' },
];

const ApproveModal: React.FC<Props> = ({ user, open, onClose, onApproved }) => {
  const [form] = Form.useForm();
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      cabinetsApi.list()
        .then((res) => setCabinets(res.data as unknown as Cabinet[]))
        .catch(() => setCabinets([]));
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await usersApi.approve(user!.id, {
        role: values.role,
        cabinet_ids: values.cabinet_ids ?? [],
      });
      message.success(`Approved ${user!.username}`);
      onApproved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const detail = axiosErr?.response?.data?.detail;
      if (typeof detail === 'string') {
        message.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Approve Registration"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="Approve"
      okButtonProps={{ loading }}
      destroyOnClose
    >
      {user && (
        <>
          <Typography.Text strong>{user.full_name}</Typography.Text>
          <Typography.Text type="secondary"> (@{user.username})</Typography.Text>
          {user.registration_note && (
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 8, fontStyle: 'italic' }}
            >
              Note: {user.registration_note}
            </Typography.Paragraph>
          )}
        </>
      )}

      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        initialValues={{ role: 'Viewer', cabinet_ids: [] }}
      >
        <Form.Item
          name="role"
          label="Assign Role"
          rules={[{ required: true, message: 'Please select a role' }]}
        >
          <Select options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item name="cabinet_ids" label="Add to Cabinets (optional)">
          <Select
            mode="multiple"
            allowClear
            placeholder="Select cabinets"
            options={cabinets.map((c) => ({
              label: `${c.name} (${c.member_usernames.length} members)`,
              value: c.id,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ApproveModal;
